import * as THREE from "three";

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

// Straight-grained walnut: long soft streaks, a few darker lines.
function createWalnutTexture(base: string) {
  const { canvas, ctx } = createCanvas(512, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 512;
    const dark = Math.random() < 0.6;
    ctx.strokeStyle = dark
      ? `rgba(20, 10, 4, ${0.02 + Math.random() * 0.06})`
      : `rgba(255, 220, 180, ${0.01 + Math.random() * 0.025})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    // Gentle drift so the grain is not ruler-straight.
    ctx.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y);
    ctx.stroke();
  }
  return toTexture(canvas);
}

// Fine brushing along one axis, used as a roughness map.
function createBrushedTexture() {
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 80 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, Math.random() * 256, 256, 0.6 + Math.random());
  }
  return toTexture(canvas, false);
}

export function createBoxMaterials(): BoxMaterials {
  return {
    wood: new THREE.MeshStandardMaterial({
      map: createWalnutTexture("#3a2416"),
      roughness: 0.9,
      envMapIntensity: 0.35,
      metalness: 0,
    }),

    panel: new THREE.MeshStandardMaterial({
      map: createWalnutTexture("#40281a"),
      roughness: 0.9,
      envMapIntensity: 0.35,
      metalness: 0,
    }),

    aluminum: new THREE.MeshStandardMaterial({
      color: 0xa4a8ad,
      metalness: 1,
      roughness: 0.5,
      roughnessMap: createBrushedTexture(),
    }),

    graphite: new THREE.MeshStandardMaterial({
      color: 0x232427,
      metalness: 0.25,
      roughness: 0.55,
    }),

    glass: new THREE.MeshStandardMaterial({
      color: 0x0d0e10,
      metalness: 0.1,
      roughness: 0.04,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  };
}
