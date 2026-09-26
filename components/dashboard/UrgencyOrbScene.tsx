"use client";

// The WebGL half of the urgency hero. Only ever loaded through next/dynamic
// from UrgencyHero, so three.js / R3F / drei stay out of the main bundle.

import { useEffect, useRef, useState, type ElementRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import { SRGBColorSpace, type Mesh } from "three";
import { urgencyRgb } from "./urgency-palette";

type DistortMaterial = ElementRef<typeof MeshDistortMaterial>;

function Orb({ score }: { score: number }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<DistortMaterial>(null);
  // Eased copy of `score` so data changes glide instead of snapping.
  const eased = useRef(score);
  const phase = useRef(0);

  // Registered after MeshDistortMaterial's own useFrame (children subscribe
  // first), so this write to `time` wins. We integrate our own phase because
  // drei's `time = elapsed * speed` jumps whenever `speed` changes.
  useFrame((state, delta) => {
    const m = material.current;
    const o = mesh.current;
    if (!m || !o) return;
    const dt = Math.min(delta, 0.1);

    eased.current += (score - eased.current) * Math.min(1, dt * 1.5);
    const s = eased.current;

    const [r, g, b] = urgencyRgb(s);
    m.color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
    m.emissive.copy(m.color).multiplyScalar(0.12 + 0.38 * s);

    // More pressure = a livelier surface, faster drift, deeper breath.
    phase.current += dt * (0.6 + 3.2 * s);
    m.time = phase.current;
    m.distort = 0.2 + 0.24 * s;

    o.rotation.y += dt * (0.1 + 0.45 * s);
    o.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.15;
    const breath = 1 + Math.sin(state.clock.elapsedTime * (0.9 + 2.1 * s)) * (0.012 + 0.03 * s);
    o.scale.setScalar(breath);
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 20]} />
      <MeshDistortMaterial
        ref={material}
        radius={1}
        roughness={0.22}
        metalness={0.08}
        clearcoat={1}
        clearcoatRoughness={0.25}
      />
    </mesh>
  );
}

export default function UrgencyOrbScene({
  score,
  onReady,
  onFail,
}: {
  score: number;
  onReady: () => void;
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stop rendering entirely while the hero is scrolled out of view.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className="urgency-orb-canvas">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 3.8], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onFail();
          });
          onReady();
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <pointLight position={[-3, -2, 2]} intensity={6} color="#b8a8ff" />
        <Orb score={score} />
      </Canvas>
    </div>
  );
}
