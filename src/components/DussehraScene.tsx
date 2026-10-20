import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type SceneVariant = "intro" | "reveal";

type DussehraSceneProps = {
  variant: SceneVariant;
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

function colorFromOklch(source: string) {
  const match = source.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return new THREE.Color(0.5, 0.5, 0.5);

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
  color.setRGB(
    Math.max(0, red),
    Math.max(0, green),
    Math.max(0, blue),
    THREE.LinearSRGBColorSpace,
  );
  return color;
}

function readTone(style: CSSStyleDeclaration, token: string): Tone {
  const color = colorFromOklch(style.getPropertyValue(token).trim());
  return { color, css: color.getStyle(THREE.SRGBColorSpace) };
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  return {
    forest: readTone(style, "--dussehra-forest"),
    leaf: readTone(style, "--dussehra-leaf"),
    leafLight: readTone(style, "--dussehra-leaf-light"),
    leafShade: readTone(style, "--dussehra-leaf-shade"),
    gold: readTone(style, "--dussehra-gold"),
    vein: readTone(style, "--dussehra-vein"),
    particle: readTone(style, "--dussehra-particle"),
    ivory: readTone(style, "--dussehra-ivory"),
  };
}

function buildLeafGeometry(palette: Palette) {
  const columns = 56;
  const rows = 52;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const shadowColor = palette.leafShade.color;
  const middleColor = palette.leaf.color;
  const lightColor = palette.leafLight.color;
  const mixedColor = new THREE.Color();

  const shapeAt = (u: number, v: number) => {
    const side = Math.abs(u);
    const bottom = -1.55 + 1.62 * side * side;
    const lobe = Math.exp(-Math.pow((side - 0.37) / 0.22, 2));
    const top = 1.06 + 0.32 * lobe - 0.99 * side * side;
    const y = bottom + (top - bottom) * v;
    const x = 1.05 * u;
    const z = 0.11 * side * side + 0.035 * Math.sin(y * 2.1 + u * 1.6) + 0.045 * Math.sin(v * Math.PI);
    return { x, y, z, bottom, top };
  };

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = (column / columns) * 2 - 1;
      const point = shapeAt(u, v);
      positions.push(point.x, point.y, point.z);
      uvs.push(column / columns, v);

      const edge = Math.pow(Math.abs(u), 1.75);
      const height = Math.max(0, Math.sin(v * Math.PI));
      mixedColor.copy(shadowColor).lerp(middleColor, 0.45 + height * 0.35);
      mixedColor.lerp(lightColor, Math.max(0, 0.18 - edge * 0.12));
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
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(80, 720, 430, 40);
  gradient.addColorStop(0, palette.leafShade.css);
  gradient.addColorStop(0.48, palette.leaf.css);
  gradient.addColorStop(1, palette.leafLight.css);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 190; index += 1) {
    const x = (index * 137.5) % canvas.width;
    const y = (index * 293.3) % canvas.height;
    const length = 16 + ((index * 31) % 84);
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 4, y - length * 0.45, x + 2, y - length);
    context.strokeStyle = index % 3 === 0 ? `${palette.gold.css.replace("rgb(", "rgba(").replace(")", ", 0.09)")}` : `${palette.leafShade.css.replace("rgb(", "rgba(").replace(")", ", 0.11)")}`;
    context.lineWidth = 1 + (index % 2);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeVeinGeometry(
  points: THREE.Vector3[],
  radius: number,
  segments: number,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segments, radius, 5, false);
}

function LeafVeins({ palette }: { palette: Palette }) {
  const veinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.vein.color,
        metalness: 0.62,
        roughness: 0.34,
      }),
    [palette],
  );
  const midrib = useMemo(
    () =>
      makeVeinGeometry(
        [
          new THREE.Vector3(0, -1.62, 0.12),
          new THREE.Vector3(0, -0.8, 0.145),
          new THREE.Vector3(0, 0.1, 0.155),
          new THREE.Vector3(0, 0.76, 0.16),
          new THREE.Vector3(0, 1.08, 0.15),
        ],
        0.018,
        44,
      ),
    [],
  );
  const branches = useMemo(() => {
    const curves: THREE.BufferGeometry[] = [];
    const levels = [-1.12, -0.78, -0.42, -0.06, 0.3, 0.61, 0.82];

    for (const y of levels) {
      for (const side of [-1, 1]) {
        const endU = 0.79;
        const endSide = Math.abs(endU);
        const bottom = -1.55 + 1.62 * endSide * endSide;
        const top = 1.06 + 0.32 * Math.exp(-Math.pow((endSide - 0.37) / 0.22, 2)) - 0.99 * endSide * endSide;
        const startV = (y + 1.55) / (1.06 + 1.55);
        const endV = Math.min(0.93, startV + 0.12);
        const endY = bottom + (top - bottom) * endV;
        const points = [
          new THREE.Vector3(0, y, 0.15),
          new THREE.Vector3(side * 0.24, y + (endY - y) * 0.34, 0.16),
          new THREE.Vector3(side * 0.5, y + (endY - y) * 0.69, 0.15),
          new THREE.Vector3(side * 0.79 * 1.05, endY, 0.13),
        ];
        curves.push(makeVeinGeometry(points, 0.007, 22));
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
  reducedMotion,
}: {
  palette: Palette;
  variant: SceneVariant;
  reducedMotion: boolean;
}) {
  const leafRef = useRef<THREE.Group>(null);
  const { geometry, shapeAt } = useMemo(() => buildLeafGeometry(palette), [palette]);
  const texture = useMemo(() => makeLeafTexture(palette), [palette]);
  const leafMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 1, 1),
        map: texture ?? undefined,
        vertexColors: true,
        roughness: 0.38,
        metalness: 0.38,
        side: THREE.DoubleSide,
      }),
    [texture],
  );
  const petiole = useMemo(
    () =>
      makeVeinGeometry(
        [
          new THREE.Vector3(0, -1.53, 0.08),
          new THREE.Vector3(0.01, -1.7, 0.09),
          new THREE.Vector3(0.02, -1.94, 0.04),
        ],
        0.028,
        14,
      ),
    [],
  );
  const petioleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.gold.color,
        metalness: 0.52,
        roughness: 0.42,
      }),
    [palette],
  );
  const rim = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const samples = 180;
    for (let index = 0; index <= samples; index += 1) {
      const u = Math.cos((index / samples) * Math.PI * 2);
      const v = Math.sin((index / samples) * Math.PI * 2) * 0.5 + 0.5;
      const point = shapeAt(u, v);
      points.push(new THREE.Vector3(point.x, point.y, point.z + 0.008));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, samples, 0.008, 4, true);
  }, [shapeAt]);
  const rimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.leafLight.color,
        metalness: 0.42,
        roughness: 0.45,
      }),
    [palette],
  );

  useFrame(({ clock, pointer, size }, rawDelta) => {
    const group = leafRef.current;
    if (!group) return;
    const delta = Math.min(rawDelta, 0.05);
    const aspect = size.width / Math.max(size.height, 1);
    const targetX = variant === "intro" ? (aspect > 1 ? 1.3 : 0.08) : aspect > 1 ? -1.65 : 0.08;
    const targetY = variant === "intro" ? 0.02 : aspect > 1 ? -0.04 : 0.52;
    const targetRotationY = (reducedMotion ? 0 : -pointer.x * 0.18) + Math.sin(clock.elapsedTime * 0.28) * (reducedMotion ? 0.012 : 0.09);
    const targetRotationX = reducedMotion ? -0.08 : -pointer.y * 0.12 - 0.08;

    group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 3.2, delta);
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      targetY + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.52) * 0.1),
      3,
      delta,
    );
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotationY, 3, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetRotationX, 3, delta);
    group.rotation.z = THREE.MathUtils.damp(
      group.rotation.z,
      Math.sin(clock.elapsedTime * 0.36) * (reducedMotion ? 0.008 : 0.025),
      2,
      delta,
    );
  });

  return (
    <group ref={leafRef} scale={variant === "intro" ? 0.92 : 0.97}>
      <mesh geometry={geometry} material={leafMaterial} castShadow receiveShadow />
      <mesh geometry={rim} material={rimMaterial} />
      <LeafVeins palette={palette} />
      <mesh geometry={petiole} material={petioleMaterial} />
    </group>
  );
}

function GoldenParticles({ palette, count }: { palette: Palette; count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const generated = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = index + 1;
      generated[index * 3] = Math.sin(seed * 78.233) * 3.8;
      generated[index * 3 + 1] = Math.sin(seed * 21.777) * 2.6;
      generated[index * 3 + 2] = Math.cos(seed * 12.989) * 1.4;
    }
    return generated;
  }, [count]);

  useFrame((_, rawDelta) => {
    if (!pointsRef.current) return;
    const delta = Math.min(rawDelta, 0.05);
    pointsRef.current.rotation.y += delta * 0.015;
    pointsRef.current.rotation.z = Math.sin(performance.now() * 0.00013) * 0.012;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={palette.particle.color}
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

function SceneContents({
  palette,
  variant,
  reducedMotion,
}: {
  palette: Palette;
  variant: SceneVariant;
  reducedMotion: boolean;
}) {
  return (
    <>
      <ambientLight color={palette.ivory.color} intensity={0.72} />
      <directionalLight
        color={palette.leafLight.color}
        position={[-3, 5, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight color={palette.gold.color} position={[3, 1, 2]} intensity={1.7} />
      <pointLight color={palette.forest.color} position={[-4, -2, 1]} intensity={0.8} />
      <Environment resolution={32}>
        <Lightformer
          color={palette.ivory.css}
          intensity={2.1}
          position={[0, 4, 2]}
          scale={[7, 2, 1]}
        />
        <Lightformer
          color={palette.gold.css}
          intensity={1.3}
          position={[-4, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[5, 1.5, 1]}
        />
      </Environment>
      <GoldenParticles palette={palette} count={variant === "intro" ? 32 : 42} />
      <AptaLeaf palette={palette} variant={variant} reducedMotion={reducedMotion} />
    </>
  );
}

export function DussehraScene({ variant }: DussehraSceneProps) {
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
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      shadows
      fallback={<div className="leaf-canvas-fallback" aria-hidden="true" />}
    >
      {palette ? (
        <SceneContents palette={palette} variant={variant} reducedMotion={reducedMotion} />
      ) : null}
    </Canvas>
  );
}