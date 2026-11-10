import * as THREE from "three";
import { gsap } from "gsap";

import type { FocusTarget } from "./BoxFace";
import { BoxRotationController } from "./BoxRotationController";

type BoxFaceFocusControllerOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  boxRoot: THREE.Group;
  focusMeshes: Map<FocusTarget, THREE.Mesh>;
  rotationController: BoxRotationController;
  // Camera distance for the overview (null) or a focused face.
  // Depends on the screen shape, so it is asked for each time.
  getCameraZ: (face: FocusTarget | null) => number;
  // Where to move the box for a target seen at the given rotation, e.g. to
  // keep the open lid in frame.
  getBoxOffset: (
    face: FocusTarget | null,
    rotation: THREE.Quaternion,
  ) => THREE.Vector3;
  onFocusChange?: (face: FocusTarget | null) => void;
};

const FACE_ROTATIONS: Record<
  FocusTarget,
  THREE.Euler
> = {
  front: new THREE.Euler(0, 0, 0),
  right: new THREE.Euler(0, -Math.PI / 2, 0),
  back: new THREE.Euler(0, Math.PI, 0),
  left: new THREE.Euler(0, Math.PI / 2, 0),
  top: new THREE.Euler(Math.PI / 2, 0, 0),
  bottom: new THREE.Euler(-Math.PI / 2, 0, 0),
  // Top tilted 60° toward the camera: looking down into the open box.
  inside: new THREE.Euler(Math.PI / 3, 0, 0),
};

// Leaving the inside view: turn the open box so the top and lid read well.
const OPEN_OVERVIEW_ROTATION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.42, 0.55, 0),
);

export class BoxFaceFocusController {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private boxRoot: THREE.Group;
  private focusMeshes: Map<FocusTarget, THREE.Mesh>;
  private rotationController: BoxRotationController;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private hoveredFace: FocusTarget | null = null;
  private focusedFace: FocusTarget | null = null;

  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownId: number | null = null;
  private pointerDownType = "mouse";

  private focusing = false;
  private onFocusChange?: (face: FocusTarget | null) => void;
  private getCameraZ: (face: FocusTarget | null) => number;
  private getBoxOffset: (
    face: FocusTarget | null,
    rotation: THREE.Quaternion,
  ) => THREE.Vector3;

  constructor(options: BoxFaceFocusControllerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.boxRoot = options.boxRoot;
    this.focusMeshes = options.focusMeshes;
    this.rotationController = options.rotationController;
    this.onFocusChange = options.onFocusChange;
    this.getCameraZ = options.getCameraZ;
    this.getBoxOffset = options.getBoxOffset;

    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  public get currentFace() {
    return this.focusedFace;
  }

  public get isFocused() {
    return this.focusedFace !== null;
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (this.focusedFace || this.focusing) return;

    this.pointerDownId = event.pointerId;
    this.pointerDownType = event.pointerType;
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (
      this.focusedFace ||
      this.focusing ||
      this.rotationController.isDragging
    ) {
      this.clearHover();
      return;
    }

    const face = this.pickFace(
      event.clientX,
      event.clientY,
    );

    this.setHoveredFace(face);
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (
      this.focusedFace ||
      this.focusing ||
      event.pointerId !== this.pointerDownId
    ) {
      this.pointerDownId = null;
      return;
    }

    const distance = Math.hypot(
      event.clientX - this.pointerDownX,
      event.clientY - this.pointerDownY,
    );

    this.pointerDownId = null;

    // 拖动是旋转盒子；只有接近“点击”才进入面操作。
    // 手指点按时会轻微抖动，所以触摸的容差更大。
    const tapTolerance =
      this.pointerDownType === "mouse" ? 7 : 14;

    if (distance > tapTolerance) return;

    const face = this.pickFace(
      event.clientX,
      event.clientY,
    );

    if (!face) return;

    this.focus(face);
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    this.exitFocus();
  };

  private pickFace(
    clientX: number,
    clientY: number,
  ): FocusTarget | null {
    const rect =
      this.canvas.getBoundingClientRect();

    this.pointer.x =
      ((clientX - rect.left) / rect.width) * 2 - 1;

    this.pointer.y =
      -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera,
    );

    const meshes = [
      ...this.focusMeshes.values(),
    ];

    const intersections =
      this.raycaster.intersectObjects(
        meshes,
        false,
      );

    if (intersections.length === 0) {
      return null;
    }

    return (
      intersections[0].object.userData.face ??
      null
    );
  }

  private setHoveredFace(face: FocusTarget | null) {
    if (face === this.hoveredFace) return;

    if (this.hoveredFace) {
      this.setFaceHighlight(
        this.hoveredFace,
        false,
      );
    }

    this.hoveredFace = face;

    if (face) {
      this.setFaceHighlight(face, true);
      this.canvas.style.cursor = "pointer";
    } else {
      this.canvas.style.cursor = "grab";
    }
  }

  private clearHover() {
    if (!this.hoveredFace) return;

    this.setFaceHighlight(
      this.hoveredFace,
      false,
    );

    this.hoveredFace = null;

    if (!this.focusedFace) {
      this.canvas.style.cursor =
        this.rotationController.isEnabled
          ? "grab"
          : "default";
    }
  }

  private setFaceHighlight(
    face: FocusTarget,
    highlighted: boolean,
  ) {
    const mesh = this.focusMeshes.get(face);

    if (!mesh) return;

    const material =
      mesh.material as THREE.MeshStandardMaterial;

    material.emissive.set(
      highlighted
        ? 0x3a2814
        : 0x000000,
    );

    material.emissiveIntensity =
      highlighted ? 0.12 : 0;
  }

  // Also switches directly from one focused target to another.
  public focus(face: FocusTarget) {
    if (this.focusing || this.focusedFace === face) return;

    const mesh = this.focusMeshes.get(face);

    if (!mesh) return;

    if (this.focusedFace) {
      this.setFaceHighlight(this.focusedFace, false);
      this.focusedFace = null;
    }

    this.focusing = true;
    this.clearHover();

    this.rotationController.stopInertia();
    this.rotationController.setEnabled(false);

    const startQuaternion =
      this.boxRoot.quaternion.clone();

    const targetQuaternion =
      new THREE.Quaternion().setFromEuler(
        FACE_ROTATIONS[face],
      );

    const state = { t: 0 };

    gsap.to(state, {
      t: 1,
      duration: 0.58,
      ease: "power3.inOut",

      onUpdate: () => {
        this.boxRoot.quaternion.slerpQuaternions(
          startQuaternion,
          targetQuaternion,
          state.t,
        );
      },

      onComplete: () => {
        this.boxRoot.quaternion.copy(
          targetQuaternion,
        );

        this.focusedFace = face;
        this.focusing = false;

        this.setFaceHighlight(face, true);
        this.canvas.style.cursor = "default";

        this.onFocusChange?.(face);
      },
    });

    gsap.to(this.camera.position, {
      z: this.getCameraZ(face),
      duration: 0.58,
      ease: "power3.inOut",
    });

    gsap.to(this.boxRoot.position, {
      ...this.getBoxOffset(face, targetQuaternion),
      duration: 0.58,
      ease: "power3.inOut",
    });
  }

  // `rotation`: turn the box to this pose on the way out (see present()).
  public exitFocus(rotation?: THREE.Quaternion) {
    if (!this.focusedFace || this.focusing) return;

    const previousFace = this.focusedFace;

    this.focusedFace = null;

    this.setFaceHighlight(
      previousFace,
      false,
    );

    gsap.to(this.camera.position, {
      z: this.getCameraZ(null),
      duration: 0.38,
      ease: "power2.inOut",
      onComplete: () => {
        this.rotationController.setEnabled(true);
        this.canvas.style.cursor = "grab";
      },
    });

    const target =
      rotation ??
      (previousFace === "inside" ? OPEN_OVERVIEW_ROTATION : null);

    gsap.to(this.boxRoot.position, {
      ...this.getBoxOffset(null, target ?? this.boxRoot.quaternion),
      duration: 0.38,
      ease: "power2.inOut",
    });

    if (target) this.turnTo(target, 0.7);

    this.onFocusChange?.(null);
  }

  private turnTo(target: THREE.Quaternion, duration: number) {
    const start = this.boxRoot.quaternion.clone();
    const state = { t: 0 };
    gsap.to(state, {
      t: 1,
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        this.boxRoot.quaternion.slerpQuaternions(start, target, state.t);
      },
    });
  }

  // "Look here": after a ring is solved, leave the face and turn the box to
  // show the part that just changed.
  public present(rotation: THREE.Quaternion) {
    if (this.focusing) return;

    if (this.focusedFace) {
      this.exitFocus(rotation);
      return;
    }

    this.rotationController.stopInertia();
    this.turnTo(rotation, 0.8);
  }

  // Called after a resize / rotation of the phone.
  public refreshCamera() {
    if (this.focusing) return;

    gsap.killTweensOf(
      this.camera.position,
    );

    this.camera.position.z =
      this.getCameraZ(
        this.focusedFace,
      );

    this.boxRoot.position.copy(
      this.getBoxOffset(this.focusedFace, this.boxRoot.quaternion),
    );

    if (!this.focusedFace) {
      this.rotationController.setEnabled(true);
    }
  }

  public dispose() {
    gsap.killTweensOf(
      this.camera.position,
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.canvas.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.canvas.removeEventListener(
      "pointerup",
      this.handlePointerUp,
    );

    window.removeEventListener(
      "keydown",
      this.handleKeyDown,
    );

    this.clearHover();
  }
}
