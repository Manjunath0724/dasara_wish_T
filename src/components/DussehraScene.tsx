import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("THREE.Clock: This module has been deprecated") ||
        args[0].includes("PCFSoftShadowMap has been removed"))
    ) {
      return;
    }
    origWarn.apply(console, args);
  };
}

export type SceneVariant = "intro" | "reveal";

export type DussehraSceneProps = {
  variant: SceneVariant;
  isLeaving?: boolean | undefined;
};

type Tone = {
  color: THREE.Color;
  css: string;
};

type Palette = {
  forest: Tone;
  leaf: Tone;
  leafLight: Tone;
  leafShade: Tone;
  gold: Tone;
  vein: Tone;
  particle: Tone;
  ivory: Tone;
};

const DEFAULT_PALETTE_HEX: Record<keyof Palette, string> = {
  forest: "#0b150e",
  leaf: "#7f9142",
  leafLight: "#fcd661",
  leafShade: "#3a4a24",
  gold: "#f5c53c",
  vein: "#fff0a0",
  particle: "#ffd764",
  ivory: "#faf6ed",
};

function colorFromOklch(source: string, fallbackHex: string): THREE.Color {
  const match = source.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) {
    try {
      return new THREE.Color(source.trim() || fallbackHex);
    } catch {
      return new THREE.Color(fallbackHex);
    }
  }

  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot * lRoot * lRoot;
  const m = mRoot * mRoot * mRoot;
  const s = sRoot * sRoot * sRoot;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const color = new THREE.Color();
  color.setRGB(Math.max(0, red), Math.max(0, green), Math.max(0, blue), THREE.LinearSRGBColorSpace);
  return color;
}

function readTone(style: CSSStyleDeclaration, token: string, fallbackHex: string): Tone {
  const raw = style.getPropertyValue(token).trim();
  const color = raw ? colorFromOklch(raw, fallbackHex) : new THREE.Color(fallbackHex);
  return { color, css: color.getStyle(THREE.SRGBColorSpace) };
}

function readPalette(): Palette {
  if (typeof document === "undefined") {
    const result: Partial<Palette> = {};
    for (const [key, hex] of Object.entries(DEFAULT_PALETTE_HEX)) {
      const color = new THREE.Color(hex);
      result[key as keyof Palette] = { color, css: hex };
    }
    return result as Palette;
  }

  const style = getComputedStyle(document.documentElement);
  return {
    forest: readTone(style, "--dussehra-forest", DEFAULT_PALETTE_HEX.forest),
    leaf: readTone(style, "--dussehra-leaf", DEFAULT_PALETTE_HEX.leaf),
    leafLight: readTone(style, "--dussehra-leaf-light", DEFAULT_PALETTE_HEX.leafLight),
    leafShade: readTone(style, "--dussehra-leaf-shade", DEFAULT_PALETTE_HEX.leafShade),
    gold: readTone(style, "--dussehra-gold", DEFAULT_PALETTE_HEX.gold),
    vein: readTone(style, "--dussehra-vein", DEFAULT_PALETTE_HEX.vein),
    particle: readTone(style, "--dussehra-particle", DEFAULT_PALETTE_HEX.particle),
    ivory: readTone(style, "--dussehra-ivory", DEFAULT_PALETTE_HEX.ivory),
  };
}

function buildLeafGeometry(palette: Palette) {
  const columns = 64;
  const rows = 56;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const shadowColor = palette.leafShade.color;
  const middleColor = palette.leaf.color;
  const lightColor = palette.leafLight.color;
  const goldColor = palette.gold.color;
  const mixedColor = new THREE.Color();

  const shapeAt = (u: number, v: number) => {
    const side = Math.abs(u);
    // Cordate heart-shaped base
    const bottom = -1.6 + 1.65 * side * side;
    // Distinct twin lobes of Bauhinia (Apta) with a deep apical cleft down center
    const lobe = Math.exp(-Math.pow((side - 0.42) / 0.24, 2));
    const top = 0.88 + 0.52 * lobe - 0.55 * side * side;
    const y = bottom + (top - bottom) * v;
    const x = 1.15 * u;
    // Botanical cupping curvature along lobes and gentle natural wave
    const z =
      0.14 * side * side +
      0.038 * Math.sin(y * 2.2 + u * 1.8) +
      0.048 * Math.sin(v * Math.PI) * (1 - side * 0.4);
    return { x, y, z, bottom, top };
  };

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = (column / columns) * 2 - 1;
      const point = shapeAt(u, v);
      positions.push(point.x, point.y, point.z);
      uvs.push(column / columns, v);

      const edge = Math.pow(Math.abs(u), 1.6);
      const height = Math.max(0, Math.sin(v * Math.PI));
      mixedColor.copy(middleColor).lerp(lightColor, 0.35 + height * 0.25);
      mixedColor.lerp(goldColor, 0.45 + Math.pow(v, 1.8) * 0.35);
      mixedColor.lerp(shadowColor, edge * 0.18);
      colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const current = row * (columns + 1) + column;
      const below = current + columns + 1;
      indices.push(current, current + 1, below, current + 1, below + 1, below);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const base = shapeAt(0, 0);
  const tip = shapeAt(0, 1);
  return { geometry, shapeAt, base, tip };
}

function makeLeafTexture(palette: Palette) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // Rich base gradient: from radiant gold highlight to luscious golden-olive
  const gradient = context.createRadialGradient(512, 540, 60, 512, 512, 560);
  gradient.addColorStop(0, "#ffea8c");
  gradient.addColorStop(0.35, "#e5bc4b");
  gradient.addColorStop(0.72, "#859744");
  gradient.addColorStop(1, "#3c4d26");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Micro-venation and golden leaf texture etching
  const goldCss = palette.gold.css;
  const veinCss = palette.vein.css;
  for (let index = 0; index < 320; index += 1) {
    const angle = (index * 137.5 * Math.PI) / 180;
    const distance = Math.sqrt(index / 320) * 440;
    const x = 512 + Math.cos(angle) * distance;
    const y = 560 + Math.sin(angle) * distance * 0.9;
    const length = 20 + ((index * 29) % 70);

    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      x + (index % 2 === 0 ? 6 : -6),
      y - length * 0.5,
      x + (index % 3 === 0 ? 3 : -3),
      y - length,
    );
    context.strokeStyle = index % 4 === 0 ? veinCss : goldCss;
    context.globalAlpha = 0.08 + (index % 5) * 0.02;
    context.lineWidth = 1 + (index % 3) * 0.8;
    context.stroke();
  }

  // Golden shimmer specks
  for (let speck = 0; speck < 180; speck += 1) {
    const sx = (speck * 411) % canvas.width;
    const sy = (speck * 683) % canvas.height;
    context.beginPath();
    context.arc(sx, sy, 0.8 + (speck % 3) * 0.5, 0, Math.PI * 2);
    context.fillStyle = veinCss;
    context.globalAlpha = 0.12 + (speck % 4) * 0.03;
    context.fill();
  }

  context.globalAlpha = 1.0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeInscriptionTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Strictly NO boxes or borders around the name
  // Big, bold, dark, highly visible typography
  ctx.font = "italic 700 152px 'Cormorant Garamond', Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = "Tanii";
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const startX = 512 - 60;

  // Deep dark drop shadow for strong 3D legibility on golden leaf
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;

  // Dark rich mahogany-espresso fill
  ctx.fillStyle = "#180804";
  ctx.fillText(text, startX, 256);

  // Fine subtle golden edge bevel for engraved luxury look
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255, 230, 140, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeText(text, startX, 256);

  // Big Deep Crimson Ruby Heart right next to Tanii
  const heartX = startX + textWidth / 2 + 82;
  const heartY = 216;
  const heartSize = 82;

  ctx.save();
  ctx.translate(heartX, heartY);
  ctx.beginPath();
  ctx.moveTo(0, heartSize * 0.28);
  ctx.bezierCurveTo(
    -heartSize * 0.5,
    -heartSize * 0.28,
    -heartSize,
    heartSize * 0.35,
    0,
    heartSize,
  );
  ctx.bezierCurveTo(
    heartSize,
    heartSize * 0.35,
    heartSize * 0.5,
    -heartSize * 0.28,
    0,
    heartSize * 0.28,
  );
  ctx.closePath();

  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  const heartGrad = ctx.createRadialGradient(
    -heartSize * 0.2,
    heartSize * 0.3,
    6,
    0,
    heartSize * 0.5,
    heartSize,
  );
  heartGrad.addColorStop(0, "#d90429");
  heartGrad.addColorStop(0.65, "#9d0208");
  heartGrad.addColorStop(1, "#370008");
  ctx.fillStyle = heartGrad;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#250005";
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function LeafInscription() {
  const texture = useMemo(() => makeInscriptionTexture(), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture ?? null,
        transparent: true,
        roughness: 0.3,
        metalness: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [texture],
  );

  return (
    <mesh
      position={[0.0, 0.06, 0.24]}
      rotation={[0.0, 0.0, 0.0]}
      scale={[1.9, 0.95, 1]}
      material={material}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

function makeVeinGeometry(points: THREE.Vector3[], radius: number, segments: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segments, radius, 6, false);
}

function LeafVeins({ palette }: { palette: Palette }) {
  const veinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.vein.color,
        metalness: 0.85,
        roughness: 0.22,
        emissive: palette.gold.color,
        emissiveIntensity: 0.18,
      }),
    [palette],
  );

  const midrib = useMemo(
    () =>
      makeVeinGeometry(
        [
          new THREE.Vector3(0, -1.68, 0.12),
          new THREE.Vector3(0, -0.85, 0.155),
          new THREE.Vector3(0, 0.08, 0.165),
          new THREE.Vector3(0, 0.72, 0.165),
          new THREE.Vector3(0, 0.98, 0.145),
        ],
        0.022,
        48,
      ),
    [],
  );

  const branches = useMemo(() => {
    const curves: THREE.BufferGeometry[] = [];
    const levels = [-1.18, -0.82, -0.44, -0.05, 0.32, 0.62, 0.82];

    for (const y of levels) {
      for (const side of [-1, 1]) {
        const endU = 0.82;
        const endSide = Math.abs(endU);
        const bottom = -1.6 + 1.65 * endSide * endSide;
        const top =
          0.88 + 0.52 * Math.exp(-Math.pow((endSide - 0.42) / 0.24, 2)) - 0.55 * endSide * endSide;
        const startV = (y + 1.6) / (1.1 + 1.6);
        const endV = Math.min(0.94, startV + 0.13);
        const endY = bottom + (top - bottom) * endV;
        const points = [
          new THREE.Vector3(0, y, 0.155),
          new THREE.Vector3(side * 0.26, y + (endY - y) * 0.35, 0.165),
          new THREE.Vector3(side * 0.55, y + (endY - y) * 0.7, 0.155),
          new THREE.Vector3(side * 0.82 * 1.15, endY, 0.13),
        ];
        curves.push(makeVeinGeometry(points, 0.009, 26));
      }
    }
    return curves;
  }, []);

  return (
    <group>
      <mesh geometry={midrib} material={veinMaterial} />
      {branches.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={veinMaterial} />
      ))}
    </group>
  );
}

function AptaLeaf({
  palette,
  variant,
  isLeaving,
  reducedMotion,
}: {
  palette: Palette;
  variant: SceneVariant;
  isLeaving?: boolean | undefined;
  reducedMotion: boolean;
}) {
  const leafRef = useRef<THREE.Group>(null);
  const { geometry, shapeAt } = useMemo(() => buildLeafGeometry(palette), [palette]);
  const texture = useMemo(() => makeLeafTexture(palette), [palette]);

  const leafMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 1, 1),
        map: texture ?? null,
        vertexColors: true,
        roughness: 0.28,
        metalness: 0.42,
        side: THREE.DoubleSide,
        envMapIntensity: 2.2,
        emissive: palette.gold.color,
        emissiveIntensity: 0.12,
      }),
    [texture, palette],
  );

  const petiole = useMemo(
    () =>
      makeVeinGeometry(
        [
          new THREE.Vector3(0, -1.58, 0.08),
          new THREE.Vector3(0.015, -1.78, 0.09),
          new THREE.Vector3(0.025, -2.05, 0.04),
        ],
        0.032,
        16,
      ),
    [],
  );

  const petioleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.gold.color,
        metalness: 0.65,
        roughness: 0.32,
      }),
    [palette],
  );

  const rim = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const samples = 190;
    for (let index = 0; index <= samples; index += 1) {
      const u = Math.cos((index / samples) * Math.PI * 2);
      const v = Math.sin((index / samples) * Math.PI * 2) * 0.5 + 0.5;
      const point = shapeAt(u, v);
      points.push(new THREE.Vector3(point.x, point.y, point.z + 0.008));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, samples, 0.009, 4, true);
  }, [shapeAt]);

  const rimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.vein.color,
        metalness: 0.75,
        roughness: 0.28,
        emissive: palette.gold.color,
        emissiveIntensity: 0.2,
      }),
    [palette],
  );

  useFrame(({ clock, pointer, size }, rawDelta) => {
    const group = leafRef.current;
    if (!group) return;
    const delta = Math.min(rawDelta, 0.05);
    const aspect = size.width / Math.max(size.height, 1);
    const time = clock.elapsedTime;

    // Responsive positioning: on desktop, placed asymmetrically; on mobile, elegant upper center
    const targetX = variant === "intro" ? (aspect > 1 ? 1.45 : 0.0) : aspect > 1 ? -1.75 : 0.0;
    const targetY =
      variant === "intro" ? (aspect > 0.85 ? 0.0 : 0.72) : aspect > 0.85 ? -0.05 : 0.76;

    // Target rotations: gentle floating yaw and pitch, responsive to pointer
    const targetRotationY =
      (reducedMotion ? 0 : -pointer.x * 0.24) +
      Math.sin(time * 0.32) * (reducedMotion ? 0.015 : 0.12) +
      (variant === "reveal" ? Math.sin(time * 0.2) * 0.08 : 0);

    const targetRotationX =
      (reducedMotion ? -0.08 : -pointer.y * 0.16 - 0.08) +
      Math.cos(time * 0.28) * (reducedMotion ? 0.01 : 0.06);

    const targetRotationZ = Math.sin(time * 0.4) * (reducedMotion ? 0.008 : 0.035);

    // Target scale
    let baseScale = variant === "intro" ? (aspect > 1 ? 1.05 : 0.85) : aspect > 1 ? 1.15 : 0.92;
    if (isLeaving) {
      baseScale *= 1.35;
    }

    group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 3.2, delta);
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      targetY + (reducedMotion ? 0 : Math.sin(time * 0.58) * 0.12),
      3.0,
      delta,
    );
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      isLeaving ? group.rotation.y + delta * 2.5 : targetRotationY,
      3.0,
      delta,
    );
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetRotationX, 3.0, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, targetRotationZ, 2.4, delta);
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, baseScale, 3.5, delta));
  });

  return (
    <group ref={leafRef} scale={variant === "intro" ? 0.95 : 1.05}>
      <mesh geometry={geometry} material={leafMaterial} castShadow receiveShadow />
      <mesh geometry={rim} material={rimMaterial} />
      <LeafVeins palette={palette} />
      <mesh geometry={petiole} material={petioleMaterial} />
      <LeafInscription />
    </group>
  );
}

function GoldenParticles({
  palette,
  count,
  isLeaving,
}: {
  palette: Palette;
  count: number;
  isLeaving?: boolean | undefined;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array | null>(null);

  const [positions, initialVelocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = index + 1;
      pos[index * 3] = (Math.sin(seed * 78.233) * 2 - 1) * 4.2;
      pos[index * 3 + 1] = (Math.cos(seed * 21.777) * 2 - 1) * 3.0;
      pos[index * 3 + 2] = (Math.sin(seed * 12.989) * 2 - 1) * 2.0;

      vel[index * 3] = (Math.sin(seed * 3.14) * 0.05) / 10;
      vel[index * 3 + 1] = (0.05 + Math.abs(Math.cos(seed * 7.1)) * 0.08) / 10;
      vel[index * 3 + 2] = (Math.cos(seed * 5.2) * 0.05) / 10;
    }
    return [pos, vel];
  }, [count]);

  if (!velocities.current) {
    velocities.current = initialVelocities;
  }

  useFrame((_, rawDelta) => {
    const points = pointsRef.current;
    if (!points) return;
    const vel = velocities.current;
    if (!vel) return;

    const delta = Math.min(rawDelta, 0.05);
    const posAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let index = 0; index < count; index += 1) {
      const i3 = index * 3;
      const vy = vel[i3 + 1] ?? 0;
      const currentY = posArray[i3 + 1] ?? 0;
      const nextY = currentY + vy * (delta * 60);
      posArray[i3 + 1] = nextY > 3.2 ? -3.2 : nextY;

      if (isLeaving) {
        // Rush towards the screen on unveil!
        const currentZ = posArray[i3 + 2] ?? 0;
        const nextZ = currentZ + delta * 14.0;
        posArray[i3 + 2] = nextZ > 5.0 ? -2.0 : nextZ;
      }
    }
    posAttr.needsUpdate = true;
    points.rotation.y += delta * (isLeaving ? 0.25 : 0.02);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={palette.particle.color}
        size={0.038}
        sizeAttenuation
        transparent
        opacity={isLeaving ? 0.95 : 0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SceneContents({
  palette,
  variant,
  isLeaving,
  reducedMotion,
}: {
  palette: Palette;
  variant: SceneVariant;
  isLeaving?: boolean | undefined;
  reducedMotion: boolean;
}) {
  return (
    <>
      <ambientLight color={palette.ivory.color} intensity={isLeaving ? 1.2 : 0.85} />
      {/* Key light casting golden brilliance */}
      <directionalLight
        color={palette.leafLight.color}
        position={[-3.5, 5, 5]}
        intensity={isLeaving ? 3.4 : 2.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Warm golden backlight highlighting veins and rim */}
      <pointLight
        color={palette.gold.color}
        position={[3.5, 1.2, 2.5]}
        intensity={isLeaving ? 3.0 : 2.0}
      />
      <pointLight color={palette.forest.color} position={[-4.5, -2.5, 1.5]} intensity={1.0} />
      <pointLight
        color={palette.gold.color}
        position={[0, 0, 4.2]}
        intensity={isLeaving ? 3.6 : 2.5}
      />
      <pointLight
        color={palette.leafLight.color}
        position={[-1.5, 2.5, 3.8]}
        intensity={isLeaving ? 3.2 : 2.0}
      />

      <Environment resolution={64}>
        <Lightformer
          color={palette.ivory.css}
          intensity={2.4}
          position={[0, 4.5, 2.5]}
          scale={[8, 3, 1]}
        />
        <Lightformer
          color={palette.gold.css}
          intensity={1.8}
          position={[-4.5, 1.5, -1]}
          rotation-y={Math.PI / 2}
          scale={[6, 2, 1]}
        />
        <Lightformer
          color={palette.leafLight.css}
          intensity={1.2}
          position={[4, -1, 2]}
          scale={[4, 2, 1]}
        />
      </Environment>

      <GoldenParticles
        palette={palette}
        count={variant === "intro" ? 48 : 64}
        isLeaving={isLeaving}
      />
      <AptaLeaf
        palette={palette}
        variant={variant}
        isLeaving={isLeaving}
        reducedMotion={reducedMotion}
      />
    </>
  );
}

export function DussehraScene({ variant, isLeaving }: DussehraSceneProps) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setPalette(readPalette());
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      className="dussehra-canvas"
      camera={{ position: [0, 0, 7], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows={{ type: THREE.PCFShadowMap }}
      fallback={<div className="leaf-canvas-fallback" aria-hidden="true" />}
    >
      {palette ? (
        <SceneContents
          palette={palette}
          variant={variant}
          isLeaving={isLeaving}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </Canvas>
  );
}
