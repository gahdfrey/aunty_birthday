"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { initialPixelRatio, timelineStep } from "@/lib/renderQuality";

const PALETTE = ["#ff6b9d", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ff9f68"];

const TIERS = [
  { radius: 1.6, height: 0.9, color: "#f7b2c4" },
  { radius: 1.15, height: 0.75, color: "#fff1e6" },
  { radius: 0.75, height: 0.6, color: "#f7b2c4" },
];

// Each tier's bottom y, so tiers stack without mutating anything during render.
const TIER_BASES = TIERS.map((_, i) => TIERS.slice(0, i).reduce((sum, tier) => sum + tier.height, 0));
const CAKE_TOP = TIERS.reduce((sum, tier) => sum + tier.height, 0);
const CANDLE_HEIGHT = 0.45;
const CANDLE_COUNT = 5;

const BALLOONS: { position: [number, number, number]; color: string }[] = [
  { position: [-3.2, 2.4, -1], color: "#ff6b9d" },
  { position: [3.1, 2.8, -1.4], color: "#4cc9f0" },
  { position: [-2.3, 3.6, -2.6], color: "#ffd166" },
  { position: [2.4, 1.6, -0.2], color: "#b388ff" },
  { position: [0.6, 4.2, -3.2], color: "#06d6a0" },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

// Time since this component's first frame (see timelineStep for how slow frames are handled).
function useIntroTime() {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += timelineStep(delta);
  });
  return elapsed;
}

// Rises, grows and turns into place once the scene appears.
function CakeIntro({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const time = useIntroTime();

  useFrame(() => {
    if (!group.current) return;
    const p = clamp01((time.current - 0.35) / 1.8);
    const eased = easeOutBack(p);
    group.current.position.y = (1 - eased) * -2.5;
    group.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, eased));
    group.current.rotation.y = (1 - easeOutCubic(p)) * -1.2;
  });

  return <group ref={group}>{children}</group>;
}

// Drifts up from below the frame, staggered by `delay`.
function BalloonIntro({ delay, children }: { delay: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const time = useIntroTime();

  useFrame(() => {
    if (!group.current) return;
    group.current.position.y = (1 - easeOutCubic(clamp01((time.current - delay) / 2.2))) * -9;
  });

  return (
    <group ref={group} position={[0, -9, 0]}>
      {children}
    </group>
  );
}

function Cake() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[2.05, 2.1, 0.1, 48]} />
        <meshStandardMaterial color="#e9e6f2" metalness={0.6} roughness={0.25} />
      </mesh>
      {TIERS.map((tier, i) => {
        const top = TIER_BASES[i] + tier.height;
        return (
          <group key={i}>
            <mesh position={[0, TIER_BASES[i] + tier.height / 2, 0]}>
              <cylinderGeometry args={[tier.radius, tier.radius, tier.height, 48]} />
              <meshStandardMaterial color={tier.color} roughness={0.55} />
            </mesh>
            <mesh position={[0, top, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[tier.radius, 0.07, 12, 64]} />
              <meshStandardMaterial color="#ffffff" roughness={0.35} />
            </mesh>
          </group>
        );
      })}
      <Sprinkles />
    </group>
  );
}

// Seeded so the sprinkles land in the same spots on every load.
function createSprinkles() {
  let s = 49297;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return TIERS.flatMap((tier, i) => {
    const radius = tier.radius - 0.15;
    const y = TIER_BASES[i] + tier.height + 0.01;
    return Array.from({ length: Math.round(radius * 30) }, () => {
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * radius;
      return {
        position: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
        rotation: new THREE.Euler(Math.PI / 2, 0, random() * Math.PI),
        color: PALETTE[Math.floor(random() * PALETTE.length)],
      };
    });
  });
}

// All sprinkles share one instanced mesh: one draw call instead of ~90, which matters on phones.
function Sprinkles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [sprinkles] = useState(createSprinkles);

  useEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    sprinkles.forEach((sprinkle, i) => {
      dummy.position.copy(sprinkle.position);
      dummy.rotation.copy(sprinkle.rotation);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, color.set(sprinkle.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor!.needsUpdate = true;
  }, [sprinkles]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, sprinkles.length]}>
      <capsuleGeometry args={[0.018, 0.07, 4, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}

function Candles({ blown }: { blown: boolean }) {
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const strength = useRef(1);

  useFrame(({ clock }, delta) => {
    strength.current = THREE.MathUtils.damp(strength.current, blown ? 0 : 1, 6, delta);
    const t = clock.elapsedTime;
    flames.current.forEach((flame, i) => {
      if (!flame) return;
      const flicker = 1 + Math.sin(t * 18 + i * 1.7) * 0.08 + Math.sin(t * 31 + i) * 0.05;
      flame.scale.set(strength.current, flicker * strength.current, strength.current);
    });
    if (light.current) {
      light.current.intensity = (3 + Math.sin(t * 20) * 0.4) * strength.current;
    }
  });

  return (
    <group position={[0, CAKE_TOP, 0]}>
      <pointLight ref={light} position={[0, CANDLE_HEIGHT + 0.4, 0]} color="#ffb35c" distance={6} />
      {Array.from({ length: CANDLE_COUNT }, (_, i) => {
        const angle = (i / CANDLE_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * 0.42;
        const z = Math.sin(angle) * 0.42;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, CANDLE_HEIGHT / 2, 0]}>
              <cylinderGeometry args={[0.045, 0.045, CANDLE_HEIGHT, 16]} />
              <meshStandardMaterial color={PALETTE[i % PALETTE.length]} roughness={0.4} />
            </mesh>
            <mesh position={[0, CANDLE_HEIGHT + 0.03, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
              <meshBasicMaterial color="#222" />
            </mesh>
            <mesh
              ref={(mesh) => {
                flames.current[i] = mesh;
              }}
              position={[0, CANDLE_HEIGHT + 0.13, 0]}
            >
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshBasicMaterial color="#ffe0a3" toneMapped={false} />
              <mesh>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial
                  color="#ff9a3c"
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  toneMapped={false}
                />
              </mesh>
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Balloon({ position, color }: { position: [number, number, number]; color: string }) {
  // A plain 1px line: much cheaper to draw than drei's thick-line shader.
  const string = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, -0.62, 0),
          new THREE.Vector3(0.08, -1.2, 0.04),
          new THREE.Vector3(-0.06, -1.8, -0.02),
          new THREE.Vector3(0.03, -2.4, 0),
        ]),
        new THREE.LineBasicMaterial({ color: "#f3e9ff", transparent: true, opacity: 0.7 }),
      ),
    [],
  );

  return (
    <Float speed={1.6} rotationIntensity={0.4} floatIntensity={1.2} position={position}>
      <mesh scale={[1, 1.18, 1]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshPhysicalMaterial color={color} roughness={0.15} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.07, 0.1, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <primitive object={string} />
    </Float>
  );
}

const CONFETTI_COUNT = 350;

function createConfettiPieces() {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    spin: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
    speed: 0.6 + Math.random() * 0.9,
    sway: Math.random() * Math.PI * 2,
    falling: false,
  }));
}

function Confetti({ active }: { active: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [pieces] = useState(createConfettiPieces);

  useEffect(() => {
    if (!mesh.current) return;
    const color = new THREE.Color();
    pieces.forEach((_, i) => {
      mesh.current!.setColorAt(i, color.set(PALETTE[i % PALETTE.length]));
    });
    mesh.current.instanceColor!.needsUpdate = true;
  }, [pieces]);

  // Pieces still in the air keep falling; only the ones that already landed start again from above.
  useEffect(() => {
    if (!active) return;
    pieces.forEach((piece) => {
      if (piece.falling) return;
      piece.falling = true;
      piece.position.set((Math.random() - 0.5) * 12, 4 + Math.random() * 8, (Math.random() - 0.5) * 8);
    });
  }, [active, pieces]);

  useFrame(({ clock }, delta) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    pieces.forEach((piece, i) => {
      if (piece.falling) {
        piece.position.y -= piece.speed * delta;
        piece.position.x += Math.sin(t * 1.5 + piece.sway) * 0.3 * delta;
        piece.rotation.x += piece.spin.x * delta;
        piece.rotation.y += piece.spin.y * delta;
        piece.rotation.z += piece.spin.z * delta;
        // Once switched off, each piece finishes its fall instead of looping back to the top.
        if (piece.position.y < -1) {
          if (active) piece.position.y = 7 + Math.random() * 2;
          else piece.falling = false;
        }
      }
      dummy.position.copy(piece.position);
      dummy.rotation.copy(piece.rotation);
      dummy.scale.setScalar(piece.falling ? 1 : 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // Always "visible", with landed pieces scaled to nothing: three.js only prepares shaders for
    // visible objects, so a hidden mesh would compile its shader (and freeze for a moment) the
    // first time the confetti appears.
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI_COUNT]}>
      <planeGeometry args={[0.09, 0.15]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.6} />
    </instancedMesh>
  );
}

// Narrow screens see less horizontally, so pull the camera back to keep the cake in frame.
function ResponsiveCamera() {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / state.size.height);

  useEffect(() => {
    const distance = aspect < 0.6 ? 12.5 : aspect < 1 ? 10.5 : 9.5;
    camera.position.set(0, 2.6, distance);
  }, [aspect, camera]);

  return null;
}

// Compiles every shader up front, then reports the first rendered frame.
// Without this, the GPU compiles shaders mid-animation and the first second stutters.
// It waits a few frames because some effects (like the contact shadow) only compile on their first render.
function SceneReady({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);

  useEffect(() => {
    gl.compile(scene, camera);
  }, [gl, scene, camera]);

  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onReady();
  });

  return null;
}

export default function BirthdayScene({
  blown,
  paused,
  onReady,
}: {
  blown: boolean;
  paused: boolean;
  onReady?: () => void;
}) {
  const [shown, setShown] = useState(false);
  // Start at a device-appropriate sharpness and drop to 1x if the device can't keep up.
  const [dpr, setDpr] = useState(initialPixelRatio);

  return (
    <div
      className="h-full w-full transition-opacity duration-1000 ease-out"
      style={{ opacity: shown ? 1 : 0 }}
    >
      <Canvas
        // Stop rendering while the letter is open so its animation gets the whole GPU.
        frameloop={paused ? "never" : "always"}
        dpr={dpr}
        camera={{ position: [0, 2.6, 9.5], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(initialPixelRatio())} />
        <ResponsiveCamera />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} />
        <hemisphereLight args={["#ffd6e8", "#2a1240", 0.6]} />

        <group position={[0, -1.5, 0]} scale={0.85}>
          <CakeIntro>
            <Cake />
            <Candles blown={blown} />
          </CakeIntro>
          {/* The shadow is drawn for the first few seconds while the cake settles, then frozen. */}
          <ContactShadows position={[0, -0.1, 0]} opacity={0.45} scale={10} blur={2.4} far={3} frames={240} />
        </group>

        {BALLOONS.map((balloon, i) => (
          <BalloonIntro key={balloon.color} delay={0.4 + i * 0.18}>
            <Balloon position={balloon.position} color={balloon.color} />
          </BalloonIntro>
        ))}

        <Sparkles count={60} scale={[10, 6, 6]} position={[0, 2, -1]} size={3} speed={0.35} color="#ffe8a3" />
        <Confetti active={blown} />

        <OrbitControls
          target={[0, 0.6, 0]}
          enablePan={false}
          minDistance={6}
          maxDistance={15}
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate
          autoRotateSpeed={0.6}
        />
        <SceneReady
          onReady={() => {
            setShown(true);
            onReady?.();
          }}
        />
      </Canvas>
    </div>
  );
}
