"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { initialPixelRatio, timelineStep } from "@/lib/renderQuality";

const WIDTH = 3;
const HEIGHT = 2;
const LETTER_WIDTH = 2.7;
const LETTER_HEIGHT = 1.75;
const SEAL_POSITION: [number, number, number] = [0, -0.08, 0.09];
// When the 3D letter has settled in front of the camera and the readable card takes over.
const REVEAL_AT = 6.4;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// Progress (0 to 1) through a segment of the timeline that starts at `start` and lasts `duration`.
const segment = (t: number, start: number, duration: number) => clamp01((t - start) / duration);
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInCubic = (p: number) => p ** 3;
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
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

function Envelope({ recipient, runId, onReveal }: { recipient: string; runId: number; onReveal: () => void }) {
  const envelope = useRef<THREE.Group>(null);
  const flapHinge = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Group>(null);
  const letter = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const revealed = useRef(false);
  const { gl, scene, camera } = useThree();

  const [texture] = useState(() => createLetterTexture(recipient));
  const [burstPieces] = useState(createBurst);
  const shapes = useMemo(
    () => ({ pocket: createPocketShape(), flap: createFlapShape(), heart: createHeartShape() }),
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
    }),
    [],
  );

  // Compile shaders, upload the letter texture and draw one frame while the scene is still
  // invisible, so all the GPU setup is done before the fly-in starts.
  useEffect(() => {
    gl.compile(scene, camera);
    gl.initTexture(texture);
    gl.render(scene, camera);
  }, [gl, scene, camera, texture]);

  // Every pose is calculated from the timeline position, so restarting is just rewinding it.
  useEffect(() => {
    elapsed.current = 0;
    revealed.current = false;
  }, [runId]);

  // The whole sequence is driven from one clock, so nothing re-renders React mid-animation.
  useFrame((state, delta) => {
    if (!envelope.current || !flapHinge.current || !seal.current || !letter.current || !burst.current) return;
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
    const burstProgress = segment(t, 3.1, 1.2);
    burst.current.visible = burstProgress > 0 && burstProgress < 1;
    if (burst.current.visible) {
      const travel = easeOutCubic(burstProgress);
      burstPieces.forEach((piece, i) => {
        scratch.dummy.position.copy(piece.direction).multiplyScalar(travel);
        scratch.dummy.scale.setScalar(piece.size * (1 - burstProgress));
        scratch.dummy.updateMatrix();
        burst.current!.setMatrixAt(i, scratch.dummy.matrix);
      });
      burst.current.instanceMatrix.needsUpdate = true;
    }

    // 4. The flap swings open over the top and folds slightly behind.
    flapHinge.current.rotation.x = -(Math.PI + 0.1) * easeInOutCubic(segment(t, 3.3, 0.9));

    // 5. The letter slides out, drifting toward the viewer.
    const slide = easeOutCubic(segment(t, 4.1, 1.0));
    env.updateMatrixWorld();
    scratch.letterPosition
      .set(0, lerp(-0.05, 1.6, slide), lerp(0.03, 0.16, slide))
      .applyMatrix4(env.matrixWorld);

    // 6. The letter lifts free and turns to face the viewer while the envelope falls away.
    const lift = easeInOutCubic(segment(t, 5.2, 1.1));
    // End at the same on-screen width as the letter card (min(92vw, 520px)) so the hand-off is seamless.
    const targetView = state.viewport.getCurrentViewport(state.camera, scratch.target);
    const cardWidth = Math.min(state.size.width * 0.92, 520) / state.size.width;
    const targetScale = (cardWidth * targetView.width) / LETTER_WIDTH;
    letter.current.position.lerpVectors(scratch.letterPosition, scratch.target, lift);
    letter.current.quaternion.slerpQuaternions(env.quaternion, scratch.facingCamera, lift);
    letter.current.scale.setScalar(lerp(fit, targetScale, lift));
    env.position.y -= 6 * easeInCubic(lift);
    env.rotation.x += 0.9 * lift;

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
        <instancedMesh ref={burst} args={[undefined, undefined, BURST_COUNT]} position={SEAL_POSITION} visible={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </instancedMesh>
      </group>

      <mesh ref={letter}>
        <planeGeometry args={[LETTER_WIDTH, LETTER_HEIGHT]} />
        {/* The emissive map keeps the paper bright and readable whatever the lighting. */}
        <meshStandardMaterial
          map={texture}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.45}
          roughness={0.9}
        />
      </mesh>
    </>
  );
}

export default function EnvelopeStage({
  recipient,
  playing,
  runId,
  onReveal,
}: {
  recipient: string;
  playing: boolean;
  runId: number;
  onReveal: () => void;
}) {
  const [dpr, setDpr] = useState(initialPixelRatio);

  return (
    <Canvas
      // Only draws while the envelope is on screen; the rest of the time it costs nothing.
      frameloop={playing ? "always" : "never"}
      dpr={dpr}
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(initialPixelRatio())} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 6]} intensity={1.6} />
      <pointLight position={[-4, -2, 4]} intensity={18} color="#ff9ec0" />
      <pointLight position={[0, 3, -3]} intensity={12} color="#ffd59a" />
      <Sparkles count={60} scale={[14, 9, 6]} size={2.4} speed={0.3} color="#ffd9a0" />
      <Envelope recipient={recipient} runId={runId} onReveal={onReveal} />
    </Canvas>
  );
}
