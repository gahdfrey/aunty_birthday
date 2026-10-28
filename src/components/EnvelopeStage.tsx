"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { reportSlowDevice, scenePixelRatio, subscribeToSceneQuality, timelineStep } from "@/lib/renderQuality";

const WIDTH = 3;
const HEIGHT = 2;
const LETTER_WIDTH = 2.7;
const LETTER_HEIGHT = 1.75;
// The letter is folded in thirds, like a real one, and unfolds once it reaches the viewer.
const PANEL_HEIGHT = LETTER_HEIGHT / 3;
const SEAL_POSITION: [number, number, number] = [0, -0.08, 0.09];
// When the 3D letter has unfolded in front of the camera and the readable card takes over.
const REVEAL_AT = 7.9;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// Progress (0 to 1) through a segment of the timeline that starts at `start` and lasts `duration`.
const segment = (t: number, start: number, duration: number) => clamp01((t - start) / duration);
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInCubic = (p: number) => p ** 3;
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
// Overshoots a little before settling, like paper springing open.
const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
const lerp = THREE.MathUtils.lerp;

function createPocketShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-WIDTH / 2, -HEIGHT / 2);
  shape.lineTo(WIDTH / 2, -HEIGHT / 2);
  shape.lineTo(WIDTH / 2, HEIGHT / 2);
  shape.lineTo(0, -0.05);
  shape.lineTo(-WIDTH / 2, HEIGHT / 2);
  shape.closePath();
  return shape;
}

// Drawn hanging down from the hinge, which sits on the envelope's top edge.
function createFlapShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-WIDTH / 2, 0);
  shape.lineTo(WIDTH / 2, 0);
  shape.lineTo(0, -1.1);
  shape.closePath();
  return shape;
}

function createHeartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.08);
  shape.bezierCurveTo(0.12, 0.02, 0.1, 0.12, 0, 0.06);
  shape.bezierCurveTo(-0.1, 0.12, -0.12, 0.02, 0, -0.08);
  return shape;
}

function createLetterTexture(recipient: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round((1024 * LETTER_HEIGHT) / LETTER_WIDTH);
  const ctx = canvas.getContext("2d")!;
  const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-playfair") || "serif";

  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ead8c8";
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = "#7a3550";
  ctx.font = `italic 78px ${serif}`;
  ctx.fillText(`Dear ${recipient},`, 80, 150);

  ctx.fillStyle = "#ecdcd0";
  [0.92, 0.84, 0.88, 0.6].forEach((length, i) => {
    ctx.fillRect(80, 225 + i * 70, (canvas.width - 160) * length, 14);
  });

  ctx.fillStyle = "#e06b8f";
  ctx.font = `64px ${serif}`;
  ctx.fillText("♥", canvas.width - 150, canvas.height - 70);

  // Faint creases where the letter was folded.
  ctx.fillStyle = "rgba(160, 120, 100, 0.12)";
  [1, 2].forEach((fold) => ctx.fillRect(0, (canvas.height * fold) / 3 - 1, canvas.width, 3));

  return toTexture(canvas);
}

// The outside of the folded letter, seen as it comes out of the envelope.
function createCoverTexture(recipient: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round((1024 * PANEL_HEIGHT) / LETTER_WIDTH);
  const ctx = canvas.getContext("2d")!;
  const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-playfair") || "serif";

  ctx.fillStyle = "#f8efe4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#7a3550";
  ctx.font = `italic 74px ${serif}`;
  ctx.fillText(`For ${recipient}`, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = "#e06b8f";
  ctx.font = `44px ${serif}`;
  ctx.fillText("♥", canvas.width / 2 - 250, canvas.height / 2);
  ctx.fillText("♥", canvas.width / 2 + 250, canvas.height / 2);

  return toTexture(canvas);
}

// A soft warm light that blooms behind the letter as it opens.
function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 236, 200, 1)");
  gradient.addColorStop(0.35, "rgba(255, 190, 150, 0.45)");
  gradient.addColorStop(1, "rgba(255, 150, 190, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(canvas);
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// One third of the letter, showing its own third of the letter texture (0 is the bottom).
function createPanelGeometry(third: number) {
  const geometry = new THREE.PlaneGeometry(LETTER_WIDTH, PANEL_HEIGHT);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + third) / 3);
  return geometry;
}

const BURST_COUNT = 60;

function createBurst() {
  return Array.from({ length: BURST_COUNT }, () => ({
    direction: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() * 0.6)
      .normalize()
      .multiplyScalar(0.8 + Math.random() * 1.4),
    size: 0.02 + Math.random() * 0.035,
  }));
}

const GLITTER_COUNT = 90;

// Gold flecks that spray out around the letter as it unfolds.
function createGlitter() {
  return Array.from({ length: GLITTER_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const reach = 1.3 + Math.random() * 1.6;
    return {
      direction: new THREE.Vector3(Math.cos(angle) * reach, Math.sin(angle) * reach * 0.75, Math.random() * 1.2 - 0.4),
      spin: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      size: 0.025 + Math.random() * 0.035,
      delay: Math.random() * 0.25,
    };
  });
}

function Envelope({ recipient, runId, onReveal }: { recipient: string; runId: number; onReveal: () => void }) {
  const envelope = useRef<THREE.Group>(null);
  const flapHinge = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Group>(null);
  const letter = useRef<THREE.Group>(null);
  const topFold = useRef<THREE.Group>(null);
  const bottomFold = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const glitter = useRef<THREE.InstancedMesh>(null);
  const burst = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const revealed = useRef(false);
  const { gl, scene, camera } = useThree();

  const [texture] = useState(() => createLetterTexture(recipient));
  const [coverTexture] = useState(() => createCoverTexture(recipient));
  const [glowTexture] = useState(createGlowTexture);
  const [burstPieces] = useState(createBurst);
  const [glitterPieces] = useState(createGlitter);
  const shapes = useMemo(
    () => ({ pocket: createPocketShape(), flap: createFlapShape(), heart: createHeartShape() }),
    [],
  );
  // The three panels share their materials, so the letter costs one shader and few state changes.
  const paper = useMemo(
    () => ({
      // The emissive map keeps the paper bright and readable whatever the lighting.
      front: new THREE.MeshStandardMaterial({
        map: texture,
        emissive: "#ffffff",
        emissiveMap: texture,
        emissiveIntensity: 0.45,
        roughness: 0.9,
      }),
      back: new THREE.MeshStandardMaterial({
        color: "#f6ecdf",
        emissive: "#ffffff",
        emissiveIntensity: 0.15,
        roughness: 0.95,
      }),
      cover: new THREE.MeshStandardMaterial({
        color: "#f6ecdf",
        map: coverTexture,
        emissive: "#ffffff",
        emissiveMap: coverTexture,
        emissiveIntensity: 0.4,
        roughness: 0.95,
      }),
    }),
    [texture, coverTexture],
  );
  const panels = useMemo(
    () => ({
      top: createPanelGeometry(2),
      middle: createPanelGeometry(1),
      bottom: createPanelGeometry(0),
      plain: new THREE.PlaneGeometry(LETTER_WIDTH, PANEL_HEIGHT),
    }),
    [],
  );
  // Reused every frame so the animation loop allocates nothing.
  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      letterPosition: new THREE.Vector3(),
      target: new THREE.Vector3(0, 0, 3.2),
      origin: new THREE.Vector3(),
      facingCamera: new THREE.Quaternion(),
      twirl: new THREE.Quaternion(),
      upAxis: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  // Compile shaders, upload the letter texture and draw one frame while the scene is still
  // invisible, so all the GPU setup is done before the fly-in starts.
  useEffect(() => {
    gl.compile(scene, camera);
    [texture, coverTexture, glowTexture].forEach((map) => gl.initTexture(map));
    gl.render(scene, camera);
  }, [gl, scene, camera, texture, coverTexture, glowTexture]);

  // Every pose is calculated from the timeline position, so restarting is just rewinding it.
  useEffect(() => {
    elapsed.current = 0;
    revealed.current = false;
  }, [runId]);

  // The whole sequence is driven from one clock, so nothing re-renders React mid-animation.
  useFrame((state, delta) => {
    if (
      !envelope.current ||
      !flapHinge.current ||
      !seal.current ||
      !letter.current ||
      !topFold.current ||
      !bottomFold.current ||
      !glow.current ||
      !glowMaterial.current ||
      !glitter.current ||
      !burst.current
    )
      return;
    elapsed.current += timelineStep(delta);
    const t = elapsed.current;
    const env = envelope.current;

    // Shrink everything on narrow screens so the envelope always fits.
    const viewWidth = state.viewport.getCurrentViewport(state.camera, scratch.origin).width;
    const fit = Math.min(1, (viewWidth * 0.86) / WIDTH);

    // 1. Spin in from far away and rush right up to the viewer, then 2. ease back to rest.
    const flyIn = easeOutCubic(segment(t, 0, 1.7));
    const settle = easeInOutCubic(segment(t, 1.7, 1.1));
    env.position.set(
      lerp(-4, 0, flyIn),
      lerp(3, 0, flyIn) + Math.sin(t * 1.4) * 0.06 * settle,
      lerp(lerp(-40, 4.6, flyIn), 0, settle),
    );
    env.rotation.set(
      Math.sin(settle * Math.PI) * 0.3,
      lerp(-3 * Math.PI, 0, flyIn),
      lerp(lerp(0.7, -0.12, flyIn), 0, settle),
    );
    env.scale.setScalar(fit);

    // 3. The wax seal swells, then pops in a shower of gold.
    const sealPop = segment(t, 2.9, 0.5);
    seal.current.scale.setScalar(
      sealPop < 0.5 ? 1 + 0.35 * easeOutCubic(sealPop * 2) : 1.35 * (1 - easeInCubic((sealPop - 0.5) * 2)),
    );
    // The sparks stay "visible" but scaled to nothing outside the burst, so their shader is
    // prepared up front with everything else instead of compiling mid-animation.
    const burstProgress = segment(t, 3.1, 1.2);
    const bursting = burstProgress > 0 && burstProgress < 1;
    const travel = easeOutCubic(burstProgress);
    burstPieces.forEach((piece, i) => {
      scratch.dummy.position.copy(piece.direction).multiplyScalar(travel);
      scratch.dummy.rotation.set(0, 0, 0);
      scratch.dummy.scale.setScalar(bursting ? piece.size * (1 - burstProgress) : 0);
      scratch.dummy.updateMatrix();
      burst.current!.setMatrixAt(i, scratch.dummy.matrix);
    });
    burst.current.instanceMatrix.needsUpdate = true;

    // 4. The flap swings open over the top and folds slightly behind.
    flapHinge.current.rotation.x = -(Math.PI + 0.1) * easeInOutCubic(segment(t, 3.3, 0.9));

    // 5. The folded letter slides out, drifting toward the viewer.
    const slide = easeOutCubic(segment(t, 4.1, 1.0));
    env.updateMatrixWorld();
    scratch.letterPosition
      .set(0, lerp(-0.25, 1.4, slide), lerp(0.022, 0.2, slide))
      .applyMatrix4(env.matrixWorld);

    // 6. The letter lifts free, twirls once and turns to face the viewer while the envelope falls away.
    const lift = easeInOutCubic(segment(t, 5.1, 1.2));
    // End at the same on-screen width as the letter card (min(92vw, 520px)) so the hand-off is seamless.
    const targetView = state.viewport.getCurrentViewport(state.camera, scratch.target);
    const cardWidth = Math.min(state.size.width * 0.92, 520) / state.size.width;
    const targetScale = (cardWidth * targetView.width) / LETTER_WIDTH;
    letter.current.position.lerpVectors(scratch.letterPosition, scratch.target, lift);
    // It floats gently once it arrives, so it never sits completely still.
    letter.current.position.y += Math.sin(t * 1.8) * 0.04 * lift;
    letter.current.quaternion.slerpQuaternions(env.quaternion, scratch.facingCamera, lift);
    scratch.twirl.setFromAxisAngle(scratch.upAxis, Math.PI * 2 * lift);
    letter.current.quaternion.multiply(scratch.twirl);
    letter.current.rotateZ(Math.sin(lift * Math.PI) * 0.25);
    letter.current.scale.setScalar(lerp(fit, targetScale, lift));
    env.position.y -= 6 * easeInCubic(lift);
    env.rotation.x += 0.9 * lift;

    // 7. The letter unfolds: the outer third flips up, then the bottom third swings down.
    const openTop = segment(t, 6.3, 0.8);
    const openBottom = segment(t, 6.75, 0.8);
    topFold.current.rotation.x = Math.PI * (1 - easeOutBack(openTop));
    bottomFold.current.rotation.x = -Math.PI * (1 - easeOutBack(openBottom));
    // As it opens, the letter leans back a touch then settles, like it is catching the light.
    letter.current.rotateX(Math.sin(openTop * Math.PI) * -0.18);

    // 8. A warm light blooms behind it, the paper glows, and gold flecks spray out.
    const bloom = segment(t, 6.3, 1.6);
    glow.current.position.set(scratch.target.x, scratch.target.y, scratch.target.z - 0.6);
    glow.current.scale.setScalar(targetScale * LETTER_WIDTH * 2.4 * easeOutCubic(bloom));
    glowMaterial.current.opacity = Math.sin(Math.min(bloom * 1.6, 1) * Math.PI * 0.5) * (1 - 0.35 * bloom);
    // The paper's own glow brightens rather than adding a light, which would cost every pixel.
    paper.front.setValues({ emissiveIntensity: 0.45 + 0.3 * Math.sin(bloom * Math.PI) });

    glitter.current.position.copy(scratch.target);
    glitterPieces.forEach((piece, i) => {
      const p = segment(t, 6.45 + piece.delay, 1.5);
      const spraying = p > 0 && p < 1;
      scratch.dummy.position
        .copy(piece.direction)
        .multiplyScalar(targetScale * easeOutCubic(p));
      scratch.dummy.position.y -= 0.7 * p * p;
      scratch.dummy.rotation.set(piece.spin.x + t * 3, piece.spin.y + t * 2, piece.spin.z);
      scratch.dummy.scale.setScalar(spraying ? piece.size * targetScale * (1 - easeInCubic(p)) : 0);
      scratch.dummy.updateMatrix();
      glitter.current!.setMatrixAt(i, scratch.dummy.matrix);
    });
    glitter.current.instanceMatrix.needsUpdate = true;

    // A little parallax so the scene responds to the pointer.
    state.camera.position.x = lerp(state.camera.position.x, state.pointer.x * 0.4, 0.05);
    state.camera.position.y = lerp(state.camera.position.y, state.pointer.y * 0.25, 0.05);
    state.camera.lookAt(0, 0, 0);

    if (t > REVEAL_AT && !revealed.current) {
      revealed.current = true;
      onReveal();
    }
  });

  return (
    <>
      <group ref={envelope} position={[0, 0, -40]}>
        <mesh>
          <boxGeometry args={[WIDTH, HEIGHT, 0.04]} />
          <meshStandardMaterial color="#c9728d" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <shapeGeometry args={[shapes.pocket]} />
          <meshStandardMaterial color="#f2b3c4" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <group ref={flapHinge} position={[0, HEIGHT / 2, 0.055]}>
          <mesh>
            <shapeGeometry args={[shapes.flap]} />
            <meshStandardMaterial color="#eaa0b6" roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group ref={seal} position={SEAL_POSITION}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.26, 0.06, 40]} />
            <meshPhysicalMaterial color="#a3153b" roughness={0.3} clearcoat={1} clearcoatRoughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <shapeGeometry args={[shapes.heart]} />
            <meshStandardMaterial color="#f5c86a" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
        <instancedMesh ref={burst} args={[undefined, undefined, BURST_COUNT]} position={SEAL_POSITION}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </instancedMesh>
      </group>

      {/* The folded letter. Each third has its printed front and a plain paper back; the two
          outer thirds hinge off the middle one and start folded over it, text side in. */}
      <group ref={letter} position={[0, 0, -40]}>
        <LetterPanel geometry={panels.middle} back={panels.plain} front={paper.front} backMaterial={paper.back} />
        <group ref={topFold} position={[0, PANEL_HEIGHT / 2, 0.01]} rotation={[Math.PI, 0, 0]}>
          <group position={[0, PANEL_HEIGHT / 2, 0]}>
            <LetterPanel geometry={panels.top} back={panels.plain} front={paper.front} backMaterial={paper.cover} />
          </group>
        </group>
        <group ref={bottomFold} position={[0, -PANEL_HEIGHT / 2, 0.005]} rotation={[-Math.PI, 0, 0]}>
          <group position={[0, -PANEL_HEIGHT / 2, 0]}>
            <LetterPanel geometry={panels.bottom} back={panels.plain} front={paper.front} backMaterial={paper.back} />
          </group>
        </group>
      </group>

      {/* Kept "visible" at zero size or brightness until needed, so nothing compiles mid-animation. */}
      <mesh ref={glow} scale={0} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={glowMaterial}
          map={glowTexture}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={glitter} args={[undefined, undefined, GLITTER_COUNT]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#f5c86a"
          emissive="#c98a2a"
          emissiveIntensity={0.7}
          metalness={0.7}
          roughness={0.25}
        />
      </instancedMesh>
    </>
  );
}

function LetterPanel({
  geometry,
  back,
  front,
  backMaterial,
}: {
  geometry: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  front: THREE.Material;
  backMaterial: THREE.Material;
}) {
  return (
    <>
      <mesh geometry={geometry} material={front} />
      {/* Turned to face the other way, so the back reads the right way up once folded over. */}
      <mesh geometry={back} material={backMaterial} rotation={[Math.PI, 0, 0]} />
    </>
  );
}

export default function EnvelopeStage({
  recipient,
  playing,
  idle,
  runId,
  onReveal,
}: {
  recipient: string;
  playing: boolean;
  // True while the letter is closed and nothing of this scene is on screen.
  idle: boolean;
  runId: number;
  onReveal: () => void;
}) {
  // Sharpness only changes while the letter is closed, never partway through an opening.
  const sharpness = useSyncExternalStore(subscribeToSceneQuality, scenePixelRatio, () => 1);
  const [dpr, setDpr] = useState(sharpness);
  if (idle && dpr !== sharpness) setDpr(sharpness);

  return (
    <Canvas
      // Only draws while the envelope is on screen; the rest of the time it costs nothing.
      frameloop={playing ? "always" : "never"}
      dpr={dpr}
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor onDecline={reportSlowDevice} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 6]} intensity={1.6} />
      <pointLight position={[-4, -2, 4]} intensity={18} color="#ff9ec0" />
      <pointLight position={[0, 3, -3]} intensity={12} color="#ffd59a" />
      <Sparkles count={60} scale={[14, 9, 6]} size={2.4} speed={0.3} color="#ffd9a0" />
      <Envelope recipient={recipient} runId={runId} onReveal={onReveal} />
    </Canvas>
  );
}
