import * as THREE from "three";
import { PALETTE, css } from "./palette";

// Modern puzzle box: walnut body, brushed aluminium hardware, graphite
// details, smoked glass windows. Amber light is the only accent.
export type BoxMaterials = {
  wood: THREE.MeshStandardMaterial;
  // Veneer on each face (puzzles sit on it; cloned per face for the highlight).
  panel: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  graphite: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
};

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, srgb = true) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Seeded so the grain is the same on every load (and in every screenshot).
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Straight-grained walnut, drawn in grey: broad growth bands, fine grain
// lines and short dark pores, then laid over the wood colour.
function createWalnutTexture(base: string, seed: number) {
  const random = seededRandom(seed);
  const size = 1024;
  const { canvas: grey, ctx } = createCanvas(size, size);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const streak = (y: number, width: number, style: string) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(-8, y);
    // Gentle drift so the grain is not ruler-straight; ends meet for tiling.
    ctx.bezierCurveTo(size / 3, y + random() * 14 - 7, (size * 2) / 3, y + random() * 14 - 7, size + 8, y);
    ctx.stroke();
  };

  // Growth bands: wide, soft, a few of them.
  for (let i = 0; i < 26; i++) {
    const dark = random() < 0.55;
    streak(
      random() * size,
      14 + random() * 46,
      dark ? `rgba(0, 0, 0, ${0.05 + random() * 0.09})` : `rgba(255, 255, 255, ${0.04 + random() * 0.07})`,
    );
  }
  // Grain lines.
  for (let i = 0; i < 520; i++) {
    const dark = random() < 0.65;
    streak(
      random() * size,
      0.6 + random() * 2.2,
      dark ? `rgba(0, 0, 0, ${0.05 + random() * 0.16})` : `rgba(255, 255, 255, ${0.03 + random() * 0.08})`,
    );
  }
  // Pores: short dark dashes along the grain.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + random() * 0.25})`;
    ctx.fillRect(random() * size, random() * size, 5 + random() * 22, 0.8 + random() * 0.8);
  }

  // Colour: the grey drawing laid over the wood colour.
  const { canvas: colour, ctx: tint } = createCanvas(size, size);
  tint.fillStyle = base;
  tint.fillRect(0, 0, size, size);
  tint.globalCompositeOperation = "overlay";
  tint.drawImage(grey, 0, 0);

  return toTexture(colour);
}

function createWoodMaterial(base: string, seed: number) {
  // Oiled finish: a soft sheen rather than dry, matt wood.
  return new THREE.MeshStandardMaterial({
    map: createWalnutTexture(base, seed),
    roughness: 0.62,
    envMapIntensity: 0.45,
    metalness: 0,
  });
}

// Fine brushing along one axis, used as a roughness map.
function createBrushedTexture() {
  const random = seededRandom(3);
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 80 + Math.floor(random() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, random() * 256, 256, 0.6 + random());
  }
  return toTexture(canvas, false);
}

export function createBoxMaterials(): BoxMaterials {
  return {
    wood: createWoodMaterial(css(PALETTE.walnut), 1),
    panel: createWoodMaterial(css(PALETTE.walnutPanel), 2),

    aluminum: new THREE.MeshStandardMaterial({
      color: PALETTE.aluminum,
      metalness: 1,
      roughness: 0.5,
      roughnessMap: createBrushedTexture(),
    }),

    graphite: new THREE.MeshStandardMaterial({
      color: PALETTE.graphite,
      metalness: 0.25,
      roughness: 0.55,
    }),

    glass: new THREE.MeshStandardMaterial({
      color: PALETTE.smokedGlass,
      metalness: 0.1,
      roughness: 0.04,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  };
}
