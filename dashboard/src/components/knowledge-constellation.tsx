"use client";

import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

const nodes = [
  { position: [-2.4, 1, -0.7] as [number, number, number], color: "#5b7cf6", scale: 0.28 },
  { position: [-0.7, -1.5, 0.6] as [number, number, number], color: "#9b6ef6", scale: 0.22 },
  { position: [0.9, 1.4, -0.4] as [number, number, number], color: "#22d3ee", scale: 0.34 },
  { position: [2.3, -0.1, 0.8] as [number, number, number], color: "#10b981", scale: 0.24 },
  { position: [1.5, -1.6, -0.8] as [number, number, number], color: "#f59e0b", scale: 0.18 },
];

function Orb({
  position,
  color,
  scale,
}: {
  position: [number, number, number];
  color: string;
  scale: number;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    mesh.rotation.x = clock.elapsedTime * 0.22;
    mesh.rotation.y = clock.elapsedTime * 0.28;
    mesh.position.y = position[1] + Math.sin(clock.elapsedTime + position[0]) * 0.08;
  });

  return (
    <Float speed={1.8} rotationIntensity={0.28} floatIntensity={0.55}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.65}
          roughness={0.5}
          metalness={0.18}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function Ring() {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    group.rotation.z = clock.elapsedTime * 0.12;
    group.rotation.x = Math.sin(clock.elapsedTime * 0.2) * 0.25;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.02, 16, 160]} />
        <meshStandardMaterial color="#5b7cf6" emissive="#5b7cf6" emissiveIntensity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2.4, 0.6, 0]}>
        <torusGeometry args={[1.35, 0.018, 16, 120]} />
        <meshStandardMaterial color="#9b6ef6" emissive="#9b6ef6" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

export function KnowledgeConstellation() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] opacity-85 lg:block">
      <Canvas camera={{ position: [0, 0, 6.2], fov: 52 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 4]} intensity={22} color="#5b7cf6" />
        <pointLight position={[-3, -2, 2]} intensity={14} color="#9b6ef6" />
        <Ring />
        <mesh scale={0.75}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshStandardMaterial color="#0d0e1a" emissive="#5b7cf6" emissiveIntensity={0.35} />
        </mesh>
        {nodes.map((node) => (
          <Orb key={node.position.join("-")} {...node} />
        ))}
      </Canvas>
    </div>
  );
}
