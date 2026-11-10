import * as THREE from "three";
import { gsap } from "gsap";
import { PALETTE } from "../palette";

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// True when the pointer at (clientX, clientY) hits `object` (not its children).
export function pickObject(
  object: THREE.Object3D,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(object, false).length > 0;
}

// Where `object`'s origin is on screen, in client pixels.
export function screenCenter(
  object: THREE.Object3D,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
) {
  const world = object.getWorldPosition(new THREE.Vector3()).project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + (world.x + 1) * 0.5 * rect.width,
    y: rect.top + (-world.y + 1) * 0.5 * rect.height,
  };
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
  root.removeFromParent();
}

export function createLed(geometry: THREE.BufferGeometry) {
  const led = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x2a2724,
      emissive: PALETTE.amber,
      emissiveIntensity: 0,
      roughness: 0.3,
    }),
  );
  return led;
}

export function setLed(led: THREE.Mesh, intensity: number, duration = 0.25) {
  return gsap.to(led.material as THREE.MeshStandardMaterial, {
    emissiveIntensity: intensity,
    duration,
  });
}

// Small parts make their own materials (disposed with the puzzle).
export function aluminum(color: number = PALETTE.aluminumBright) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.32 });
}

export function graphite(color: number = PALETTE.graphiteLight) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.55 });
}

export function smokedGlass(opacity = 0.35) {
  return new THREE.MeshStandardMaterial({
    color: PALETTE.smokedGlass,
    metalness: 0.1,
    roughness: 0.04,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}
