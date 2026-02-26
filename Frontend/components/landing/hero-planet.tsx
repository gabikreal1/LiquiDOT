"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere } from "@react-three/drei";
import * as THREE from "three";

// ── Fresnel iridescent planet ──────────────────────────────────────
function Planet({ mousePos }: { mousePos: React.RefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<
    THREE.MeshStandardMaterial & { distort?: number }
  >(null);
  const rotCurrent = useRef({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const distortTarget = useRef(0.35);

  // Animate distort on hover
  useEffect(() => {
    distortTarget.current = hovered ? 0.55 : 0.35;
  }, [hovered]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Slow continuous Y rotation
    meshRef.current.rotation.y += delta * 0.1;

    // Smooth mouse-follow tilt
    const mx = mousePos.current?.x ?? 0;
    const my = mousePos.current?.y ?? 0;
    rotCurrent.current.x += (my * 0.2 - rotCurrent.current.x) * 0.04;
    rotCurrent.current.y += (mx * 0.2 - rotCurrent.current.y) * 0.04;
    meshRef.current.rotation.x = rotCurrent.current.x;
    meshRef.current.rotation.z = rotCurrent.current.y * 0.3;

    // Smooth distort lerp
    if (matRef.current && "distort" in matRef.current) {
      const current = (matRef.current as { distort: number }).distort;
      (matRef.current as { distort: number }).distort +=
        (distortTarget.current - current) * 0.08;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[2, 128, 128]} />
        <MeshDistortMaterial
          ref={matRef as never}
          color="#0D6B58"
          distort={0.35}
          speed={1.8}
          roughness={0.15}
          metalness={0.15}
          emissive="#00E5A0"
          emissiveIntensity={0.08}
          onBeforeCompile={(shader: { fragmentShader: string; vertexShader: string }) => {
            // Inject Fresnel-based rim coloring (teal center → pink edges)
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <dithering_fragment>",
              `
              // Fresnel iridescence: pink rim glow
              vec3 viewDir = normalize(vViewPosition);
              vec3 norm = normalize(vNormal);
              float fresnel = pow(1.0 - abs(dot(viewDir, norm)), 3.0);
              vec3 pinkRim = vec3(0.9, 0.0, 0.48); // #E6007A
              gl_FragColor.rgb = mix(gl_FragColor.rgb, pinkRim, fresnel * 0.65);
              // Subtle mint inner glow
              float innerGlow = pow(max(dot(viewDir, norm), 0.0), 2.0);
              gl_FragColor.rgb += vec3(0.0, 0.9, 0.63) * innerGlow * 0.04;
              #include <dithering_fragment>
              `
            );
          }}
        />
      </mesh>
    </Float>
  );
}

// ── Orbiting particles with true orbital motion ────────────────────
function OrbitalParticles({ mousePos }: { mousePos: React.RefObject<{ x: number; y: number }> }) {
  const count = 220;
  const pointsRef = useRef<THREE.Points>(null);

  // Store initial orbital params per particle
  const orbitalData = useMemo(() => {
    const data = [];
    const rings = [
      { radius: 2.8, tiltX: 0, tiltZ: 0, speed: 0.25 },
      { radius: 3.4, tiltX: 0.44, tiltZ: 0.15, speed: 0.18 },
      { radius: 4.2, tiltX: -0.26, tiltZ: 0.3, speed: 0.10 },
    ];

    for (let i = 0; i < count; i++) {
      const isStray = i >= 190;
      const ring = rings[i % 3];
      const theta = Math.random() * Math.PI * 2;
      const rand = Math.random();
      // 60% mint, 25% pink, 15% white
      const colorIdx = rand < 0.6 ? 0 : rand < 0.85 ? 1 : 2;
      const size = isStray
        ? Math.random() * 0.06 + 0.02
        : Math.random() * 0.08 + 0.03;
      const opacity = Math.random() * 0.5 + 0.4;

      data.push({
        ring: isStray ? null : ring,
        theta,
        offset: (Math.random() - 0.5) * 0.5,
        yOffset: (Math.random() - 0.5) * 0.6,
        strayDir: isStray
          ? new THREE.Vector3(
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2
            )
              .normalize()
              .multiplyScalar(3.5 + Math.random() * 3)
          : null,
        straySpeed: Math.random() * 0.15 + 0.05,
        colorIdx,
        size,
        opacity,
      });
    }
    return data;
  }, []);

  const colors = useMemo(() => {
    const palette = [
      new THREE.Color("#00E5A0"),
      new THREE.Color("#E6007A"),
      new THREE.Color("#FFFFFF"),
    ];
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = palette[orbitalData[i].colorIdx];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return col;
  }, [orbitalData]);

  const positionsRef = useRef(new Float32Array(count * 3));
  const sizesRef = useRef(new Float32Array(count));

  // Init sizes
  useMemo(() => {
    for (let i = 0; i < count; i++) {
      sizesRef.current[i] = orbitalData[i].size;
    }
  }, [orbitalData]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = positionsRef.current;
    const mx = mousePos.current?.x ?? 0;
    const my = mousePos.current?.y ?? 0;

    for (let i = 0; i < count; i++) {
      const d = orbitalData[i];

      if (d.strayDir) {
        // Stray particles: drift with noise
        const drift = Math.sin(t * d.straySpeed + i) * 0.3;
        pos[i * 3] = d.strayDir.x + Math.sin(t * d.straySpeed + i * 0.7) * drift;
        pos[i * 3 + 1] = d.strayDir.y + Math.cos(t * d.straySpeed + i * 1.3) * drift;
        pos[i * 3 + 2] = d.strayDir.z + Math.sin(t * d.straySpeed * 0.7 + i) * drift;
      } else if (d.ring) {
        // Orbital particles: actual orbit
        const angle = d.theta + t * d.ring.speed;
        const r = d.ring.radius + d.offset;
        let x = Math.cos(angle) * r;
        let y = d.yOffset + Math.sin(angle * 0.5) * 0.2;
        let z = Math.sin(angle) * r;

        // Apply ring tilt
        const cosT = Math.cos(d.ring.tiltX);
        const sinT = Math.sin(d.ring.tiltX);
        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;
        y = y2;
        z = z2;

        const cosZ = Math.cos(d.ring.tiltZ);
        const sinZ = Math.sin(d.ring.tiltZ);
        const x2 = x * cosZ - y * sinZ;
        const y3 = x * sinZ + y * cosZ;
        x = x2;
        y = y3;

        // Mouse repulsion
        const dx = x - mx * 3;
        const dy = y - my * 3;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2.0) {
          const force = (2.0 - dist) * 0.15;
          x += (dx / dist) * force;
          y += (dy / dist) * force;
        }

        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }
    }

    const geom = pointsRef.current.geometry;
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ── Scene with canvas-level mouse tracking ─────────────────────────
function Scene() {
  const { viewport } = useThree();
  const mousePos = useRef({ x: 0, y: 0 });
  const scale = Math.min(viewport.width / 7, 1);

  return (
    <group
      scale={scale}
      onPointerMove={(e) => {
        // Normalized -1 to 1 across the canvas
        mousePos.current.x = (e.point.x / viewport.width) * 2;
        mousePos.current.y = (e.point.y / viewport.height) * 2;
      }}
    >
      {/* Invisible capture plane for mouse events across entire canvas */}
      <mesh visible={false}>
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial />
      </mesh>

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 3]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-3, -3, 2]} intensity={0.6} color="#00E5A0" />
      <pointLight position={[0, -4, 4]} intensity={0.3} color="#E6007A" />

      <Planet mousePos={mousePos} />
      <OrbitalParticles mousePos={mousePos} />
    </group>
  );
}

export function HeroPlanet() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene />
    </Canvas>
  );
}
