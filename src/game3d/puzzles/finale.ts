import * as THREE from "three";

import { aluminum } from "./puzzleUtils";

export const TOKEN_BLUE = 0x4d8dff;
const TOKEN_RADIUS = 0.42;
const TOKEN_THICKNESS = 0.08;

// The key token from the inner case: a machined hex coin with a glowing blue
// ring set into both faces. Its faces look along ±z.
export function createToken() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(TOKEN_RADIUS, TOKEN_RADIUS, TOKEN_THICKNESS, 6),
    aluminum(0xb9bec5),
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const glow = new THREE.MeshStandardMaterial({
    color: 0x1d4fd6,
    emissive: TOKEN_BLUE,
    emissiveIntensity: 1.2,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const core = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.4 });
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.27, 40), glow);
    ring.position.z = side * (TOKEN_THICKNESS / 2 + 0.002);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 6), core);
    dot.position.z = ring.position.z;
    if (side < 0) {
      ring.rotation.y = Math.PI;
      dot.rotation.y = Math.PI;
    }
    group.add(ring, dot);
  }
  return { group, glow };
}

// Brilliant cut: flat table, crown, girdle, pointed pavilion. Few lathe
// segments and flat normals give it facets.
function brilliantGeometry(size: number) {
  const points = [
    new THREE.Vector2(0.001, -0.86),
    new THREE.Vector2(1, -0.02),
    new THREE.Vector2(1, 0.04),
    new THREE.Vector2(0.56, 0.38),
    new THREE.Vector2(0.001, 0.38),
  ].map((p) => p.multiplyScalar(size));
  const geometry = new THREE.LatheGeometry(points, 16).toNonIndexed();
  geometry.computeVertexNormals();
  return geometry;
}

function sparkleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 22);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  // Four-point star.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const [w, h] of [[3, 60], [60, 3]]) {
    ctx.beginPath();
    ctx.ellipse(64, 64, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// The prize: a clear brilliant-cut stone with coloured fire and twinkles.
export function createPrizeGem() {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(
    brilliantGeometry(0.6),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 1,
      thickness: 0.8,
      ior: 2.42,
      dispersion: 6,
      iridescence: 0.5,
      iridescenceIOR: 1.8,
      envMapIntensity: 2.5,
      specularIntensity: 1,
      flatShading: true,
    }),
  );
  group.add(stone);

  const map = sparkleTexture();
  const sparkles: THREE.Sprite[] = [];
  for (const [x, y, z] of [
    [0.42, 0.25, 0.35],
    [-0.5, 0.06, 0.3],
    [0.14, -0.42, 0.4],
    [-0.2, 0.24, -0.4],
  ]) {
    const sparkle = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      }),
    );
    sparkle.position.set(x, y, z);
    sparkle.scale.setScalar(0.7);
    group.add(sparkle);
    sparkles.push(sparkle);
  }
  return { group, stone, sparkles };
}
