"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  Line,
  OrbitControls,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";

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

function Cake() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <cylinderGeometry args={[2.05, 2.1, 0.1, 64]} />
        <meshStandardMaterial color="#e9e6f2" metalness={0.6} roughness={0.25} />
      </mesh>
      {TIERS.map((tier, i) => {
        const top = TIER_BASES[i] + tier.height;
        return (
          <group key={i}>
            <mesh position={[0, TIER_BASES[i] + tier.height / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[tier.radius, tier.radius, tier.height, 64]} />
              <meshStandardMaterial color={tier.color} roughness={0.55} />
            </mesh>
            <mesh position={[0, top, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[tier.radius, 0.07, 16, 80]} />
              <meshStandardMaterial color="#ffffff" roughness={0.35} />
            </mesh>
            <Sprinkles radius={tier.radius - 0.15} y={top + 0.01} seed={i} />
          </group>
        );
      })}
    </group>
  );
}

// Seeded so the sprinkles land in the same spots on every render.
function createSprinkles(radius: number, y: number, seed: number) {
  let s = seed * 9301 + 49297;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: Math.round(radius * 30) }, () => {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * radius;
    return {
      position: [Math.cos(angle) * r, y, Math.sin(angle) * r] as const,
      rotation: [Math.PI / 2, 0, random() * Math.PI] as const,
      color: PALETTE[Math.floor(random() * PALETTE.length)],
    };
  });
}

function Sprinkles({ radius, y, seed }: { radius: number; y: number; seed: number }) {
  const sprinkles = useMemo(() => createSprinkles(radius, y, seed), [radius, y, seed]);

  return (
    <>
      {sprinkles.map((sprinkle, i) => (
        <mesh key={i} position={sprinkle.position} rotation={sprinkle.rotation}>
          <capsuleGeometry args={[0.018, 0.07, 4, 8]} />
          <meshStandardMaterial color={sprinkle.color} />
        </mesh>
      ))}
    </>
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
            <mesh position={[0, CANDLE_HEIGHT / 2, 0]} castShadow>
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
  const stringPoints = useMemo(
    () => [
      new THREE.Vector3(0, -0.62, 0),
      new THREE.Vector3(0.08, -1.2, 0.04),
      new THREE.Vector3(-0.06, -1.8, -0.02),
      new THREE.Vector3(0.03, -2.4, 0),
    ],
    [],
  );

  return (
    <Float speed={1.6} rotationIntensity={0.4} floatIntensity={1.2} position={position}>
      <mesh scale={[1, 1.18, 1]} castShadow>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshPhysicalMaterial color={color} roughness={0.15} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.07, 0.1, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Line points={stringPoints} color="#f3e9ff" lineWidth={1} transparent opacity={0.7} />
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

  useEffect(() => {
    if (!active) return;
    pieces.forEach((piece) => {
      piece.position.set(
        (Math.random() - 0.5) * 12,
        4 + Math.random() * 8,
        (Math.random() - 0.5) * 8,
      );
    });
  }, [active, pieces]);

  useFrame(({ clock }, delta) => {
    if (!mesh.current) return;
    mesh.current.visible = active;
    if (!active) return;
    const t = clock.elapsedTime;
    pieces.forEach((piece, i) => {
      piece.position.y -= piece.speed * delta;
      piece.position.x += Math.sin(t * 1.5 + piece.sway) * 0.3 * delta;
      if (piece.position.y < -1) piece.position.y = 7 + Math.random() * 2;
      piece.rotation.x += piece.spin.x * delta;
      piece.rotation.y += piece.spin.y * delta;
      piece.rotation.z += piece.spin.z * delta;
      dummy.position.copy(piece.position);
      dummy.rotation.copy(piece.rotation);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI_COUNT]} visible={false}>
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

export default function BirthdayScene({ blown, paused }: { blown: boolean; paused: boolean }) {
  return (
    <Canvas
      shadows
      // Stop rendering while the letter is open so its animation gets the whole GPU.
      frameloop={paused ? "never" : "always"}
      dpr={[1, 2]}
      camera={{ position: [0, 2.6, 9.5], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ResponsiveCamera />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 5]} intensity={1.4} castShadow />
      <hemisphereLight args={["#ffd6e8", "#2a1240", 0.6]} />

      <group position={[0, -1.5, 0]} scale={0.85}>
        <Cake />
        <Candles blown={blown} />
        <ContactShadows position={[0, -0.1, 0]} opacity={0.45} scale={10} blur={2.4} far={3} />
      </group>

      <Balloon position={[-3.2, 2.4, -1]} color="#ff6b9d" />
      <Balloon position={[3.1, 2.8, -1.4]} color="#4cc9f0" />
      <Balloon position={[-2.3, 3.6, -2.6]} color="#ffd166" />
      <Balloon position={[2.4, 1.6, -0.2]} color="#b388ff" />
      <Balloon position={[0.6, 4.2, -3.2]} color="#06d6a0" />

      <Sparkles count={80} scale={[10, 6, 6]} position={[0, 2, -1]} size={3} speed={0.35} color="#ffe8a3" />
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
    </Canvas>
  );
}
