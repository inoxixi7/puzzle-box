import * as THREE from "three";

export const BOX_FACE_NAMES = [
  "front",
  "right",
  "back",
  "left",
  "top",
  "bottom",
] as const;

export type BoxFaceName = (typeof BOX_FACE_NAMES)[number];

// "inside": the view into the box once the lid is open.
export type FocusTarget = BoxFaceName | "inside";

export type BoxDimensions = {
  width: number;
  height: number;
  depth: number;
};

export function createFaceAnchors(dimensions: BoxDimensions) {
  const { width, height, depth } = dimensions;
  const offset = 0.015;

  const anchors: Record<BoxFaceName, THREE.Group> = {
    front: new THREE.Group(),
    right: new THREE.Group(),
    back: new THREE.Group(),
    left: new THREE.Group(),
    top: new THREE.Group(),
    bottom: new THREE.Group(),
  };

  anchors.front.position.set(0, 0, depth / 2 + offset);

  anchors.back.position.set(0, 0, -depth / 2 - offset);
  anchors.back.rotation.y = Math.PI;

  anchors.right.position.set(width / 2 + offset, 0, 0);
  anchors.right.rotation.y = Math.PI / 2;

  anchors.left.position.set(-width / 2 - offset, 0, 0);
  anchors.left.rotation.y = -Math.PI / 2;

  anchors.top.position.set(0, height / 2 + offset, 0);
  anchors.top.rotation.x = -Math.PI / 2;

  anchors.bottom.position.set(0, -height / 2 - offset, 0);
  anchors.bottom.rotation.x = Math.PI / 2;

  for (const name of BOX_FACE_NAMES) {
    anchors[name].name = `face-${name}`;
    anchors[name].userData.face = name;
  }

  return anchors;
}
