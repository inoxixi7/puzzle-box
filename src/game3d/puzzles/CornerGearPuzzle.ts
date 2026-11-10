import * as THREE from "three";
import { gsap } from "gsap";

import {
  createSealMedalGroup,
} from "./SealMedal";
import { PALETTE } from "../palette";

type CornerGearPuzzleOptions = {
  // Knob position and puck drawer position, both on the right face.
  anchor: THREE.Group;
  medalAnchor: THREE.Object3D;
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;

  // Called with the gear's rotation whenever it turns (drives the top dial).
  onGearTurn?: (rotation: number) => void;
  onSolved?: () => void;
  onMedalPickedUp?: () => void;
};

// Right-face knob: jammed until the NFC log is read (freeGear()). Turning it
// to the three directions from the log (each snap is judged) opens the
// drawer with the magnetic puck.
const GEAR_SCALE = 0.85;
const MEDAL_SCALE = 0.65;

export class CornerGearPuzzle {
  private anchor: THREE.Group;
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;

  private root = new THREE.Group();
  private dialRoot = new THREE.Group();
  private medalAnchor: THREE.Object3D;
  private medalRoot = new THREE.Group();

  private raycaster =
    new THREE.Raycaster();

  private pointer =
    new THREE.Vector2();

  private dialHitbox:
    THREE.Mesh;

  private confirmButton:
    THREE.Mesh | null = null;

  private confirmHint:
    THREE.Mesh | null = null;

  private medalHitbox:
    THREE.Mesh | null = null;

  private dialGroup =
    new THREE.Group();

  private medalGroup =
    new THREE.Group();

  private progressLights:
    THREE.Mesh[] = [];

  private enabled = false;

  private gearFree = false;
  private directionSolved = false;

  private medalAvailable = false;
  private medalPickedUp = false;

  private rotatingDial = false;
  private pointerId:
    number | null = null;

  private startPointerAngle = 0;
  private startDialRotation = 0;

  private currentDirection = 0;
  private sequenceIndex = 0;

  private onGearTurn?: (rotation: number) => void;
  private onSolved?: () => void;
  private onMedalPickedUp?: () => void;

  private readonly correctSequence = [
    1,
    4,
    6,
  ];

  constructor(
    options:
      CornerGearPuzzleOptions,
  ) {
    this.anchor = options.anchor;
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.onGearTurn = options.onGearTurn;
    this.onSolved = options.onSolved;
    this.onMedalPickedUp = options.onMedalPickedUp;

    this.root.name = "corner-gear-puzzle";
    this.anchor.add(this.root);

    this.dialRoot.scale.setScalar(GEAR_SCALE);
    this.root.add(this.dialRoot);

    this.medalAnchor = options.medalAnchor;
    this.medalRoot.scale.setScalar(MEDAL_SCALE);
    this.medalAnchor.add(this.medalRoot);

    this.dialHitbox = this.createDirectionDial();
    this.createKnobRim();
    this.createConfirmButton();
    this.createMedalCompartment();

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  // Knurled edge: the dial reads as a knob to grip. The gear it drives is
  // inside the box.
  private createKnobRim() {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.06, 1.06, 0.24, 72, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xb4b9bf,
        roughness: 0.4,
        metalness: 1,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.z = -0.04;
    rim.castShadow = true;
    this.dialGroup.add(rim);
  }

  private setDialRotation(rotation: number) {
    this.dialGroup.rotation.z = rotation;
    this.onGearTurn?.(rotation);
  }

  // Jammed: it only gives a little before the pin stops it.
  private wiggleJammedGear() {
    const start = this.dialGroup.rotation.z;
    const state = { r: start };
    const update = () => this.setDialRotation(state.r);
    gsap
      .timeline()
      .to(state, { r: start - 0.06, duration: 0.06, onUpdate: update })
      .to(state, { r: start + 0.04, duration: 0.06, onUpdate: update })
      .to(state, { r: start, duration: 0.08, onUpdate: update });
  }

  // ==================================================
  // DIRECTION DIAL
  // ==================================================

  private createDirectionDial() {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.98,
        0.98,
        0.12,
        64,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x26272a,
        roughness: 0.64,
        metalness: 0.2,
      }),
    );

    plate.rotation.x =
      Math.PI / 2;

    plate.position.set(
      0,
      -0.02,
      0.11,
    );

    plate.castShadow = true;

    this.dialRoot.add(plate);

    const tickMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xc6cacf,
        roughness: 0.34,
        metalness: 0.70,
      });

    for (
      let i = 0;
      i < 8;
      i++
    ) {
      const angle =
        (i / 8) *
        Math.PI *
        2;

      const tick =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.05,
            0.18,
            0.05,
          ),
          tickMaterial,
        );

      tick.position.set(
        Math.sin(angle) *
          0.80,
        Math.cos(angle) *
          0.80 -
          0.02,
        0.20,
      );

      tick.rotation.z =
        -angle;

      this.dialRoot.add(tick);
    }

    this.dialGroup.position.set(
      0,
      -0.02,
      0.23,
    );

    // Slim aluminium needle: clearer direction and visually closer to a
    // mechanical instrument than the previous thick stem + cone.
    const needleShape =
      new THREE.Shape();

    needleShape.moveTo(
      -0.045,
      -0.14,
    );

    needleShape.lineTo(
      -0.035,
      0.39,
    );

    needleShape.lineTo(
      -0.10,
      0.39,
    );

    needleShape.lineTo(
      0,
      0.68,
    );

    needleShape.lineTo(
      0.10,
      0.39,
    );

    needleShape.lineTo(
      0.035,
      0.39,
    );

    needleShape.lineTo(
      0.045,
      -0.14,
    );

    needleShape.closePath();

    const needle =
      new THREE.Mesh(
        new THREE.ShapeGeometry(
          needleShape,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xd6d9dc,
          roughness: 0.24,
          metalness: 0.78,
        }),
      );

    needle.position.z =
      0.035;

    const counterWeight =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.13,
          32,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x8a8f95,
          roughness: 0.30,
          metalness: 0.70,
        }),
      );

    counterWeight.position.set(
      0,
      -0.16,
      0.025,
    );

    const hubOuter =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.18,
          36,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x3a3c40,
          roughness: 0.34,
          metalness: 0.64,
        }),
      );

    hubOuter.position.z =
      0.055;

    const hubInner =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.09,
          32,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xd6d9dc,
          roughness: 0.24,
          metalness: 0.78,
        }),
      );

    hubInner.position.z =
      0.065;

    this.dialGroup.add(
      counterWeight,
      needle,
      hubOuter,
      hubInner,
    );

    this.dialRoot.add(
      this.dialGroup,
    );

    const hitbox =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.28,
          1.22, // includes the teeth
          64,
        ),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side:
            THREE.DoubleSide,
        }),
      );

    hitbox.position.set(
      0,
      -0.02,
      0.30,
    );

    this.dialRoot.add(hitbox);

    // 3 个输入进度灯
    for (
      let i = 0;
      i < 3;
      i++
    ) {
      const light =
        new THREE.Mesh(
          new THREE.CircleGeometry(
            0.08,
            24,
          ),
          new THREE.MeshStandardMaterial({
            color: 0x2a2724,
            roughness: 0.52,
            metalness: 0.38,
            emissive: 0x000000,
            emissiveIntensity: 0,
          }),
        );

      light.position.set(
        -0.22 +
          i * 0.22,
        -0.5,
        0.24,
      );

      this.progressLights.push(
        light,
      );

      this.dialRoot.add(light);
    }

    return hitbox;
  }

  private createConfirmButton() {
    const socket =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.22,
          0.29,
          40,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x3a3c40,
          roughness: 0.38,
          metalness: 0.62,
        }),
      );

    socket.position.set(
      0,
      -0.02,
      0.295,
    );

    this.dialRoot.add(socket);

    const button =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.18,
          0.18,
          0.11,
          36,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xd6d9dc,
          roughness: 0.25,
          metalness: 0.80,
        }),
      );

    button.rotation.x =
      Math.PI / 2;

    button.position.set(
      0,
      -0.02,
      0.33,
    );

    this.confirmButton =
      button;

    this.dialRoot.add(button);

    const centerDot =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.052,
          28,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x26272a,
        }),
      );

    centerDot.position.set(
      0,
      -0.02,
      0.392,
    );

    this.dialRoot.add(
      centerDot,
    );

    // 操作提示：每次圆盘吸附到一个方向后，
    // 这圈会扩散一次，提示玩家按下中央按钮确认。
    const hintMaterial =
      new THREE.MeshBasicMaterial({
        color: PALETTE.amber,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side:
          THREE.DoubleSide,
      });

    this.confirmHint =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.31,
          0.345,
          44,
        ),
        hintMaterial,
      );

    this.confirmHint.position.set(
      0,
      -0.02,
      0.40,
    );

    this.dialRoot.add(
      this.confirmHint,
    );

    const hitbox =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.31,
          36,
        ),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side:
            THREE.DoubleSide,
        }),
      );

    hitbox.position.set(
      0,
      -0.02,
      0.43,
    );

    this.dialRoot.add(hitbox);

    return hitbox;
  }

  private confirmDirection() {
    if (
      !this.gearFree ||
      this.directionSolved
    ) {
      return;
    }

    // Released on the step already counted: nothing changed.
    if (
      this.sequenceIndex > 0 &&
      this.currentDirection === this.correctSequence[this.sequenceIndex - 1]
    ) {
      return;
    }

    const expected =
      this.correctSequence[
        this.sequenceIndex
      ];

    if (
      this.currentDirection ===
      expected
    ) {
      const light =
        this.progressLights[
          this.sequenceIndex
        ];

      const material =
        light.material as
          THREE.MeshStandardMaterial;

      material.color.set(
        PALETTE.amber,
      );

      material.emissive.set(
        PALETTE.amber,
      );

      material.emissiveIntensity =
        0.9;

      gsap
        .timeline()
        .to(light.scale, {
          x: 1.28,
          y: 1.28,
          z: 1.28,
          duration: 0.08,
        })
        .to(light.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.13,
          ease: "back.out(2)",
        });

      this.sequenceIndex++;

      if (
        this.sequenceIndex ===
        this.correctSequence.length
      ) {
        this.directionSolved =
          true;

        this.openMedalCompartment();

        return;
      }
    } else {
      this.sequenceIndex = 0;

      for (
        const light
        of this.progressLights
      ) {
        const material =
          light.material as
            THREE.MeshStandardMaterial;

        material.color.set(
          0x2a2724,
        );

        material.emissive.set(
          0x000000,
        );

        material.emissiveIntensity =
          0;
      }

      if (this.currentDirection === this.correctSequence[0]) {
        this.confirmDirection();
        return;
      }

      gsap
        .timeline()
        .to(this.dialGroup.position, {
          x: 0.07,
          duration: 0.04,
        })
        .to(
          this.dialGroup.position,
          {
            x: -0.07,
            duration: 0.04,
          },
        )
        .to(
          this.dialGroup.position,
          {
            x: 0,
            duration: 0.05,
          },
        );
    }
  }


  // ==================================================
  // MEDAL
  // ==================================================

  private createMedalCompartment() {
    const cavity =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          1.20,
          1.02,
          0.10,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x111113,
          roughness: 0.92,
          metalness: 0.04,
        }),
      );

    cavity.position.set(
      0,
      0,
      0.09,
    );

    this.medalRoot.add(
      cavity,
    );

    const frame =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.43,
          0.51,
          12,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x9a9fa5,
          roughness: 0.40,
          metalness: 0.62,
        }),
      );

    frame.position.set(
      0,
      0,
      0.16,
    );

    this.medalRoot.add(
      frame,
    );

    this.medalGroup.position.set(
      0,
      0,
      0.24,
    );

    this.medalGroup.visible =
      false;

    this.medalGroup.add(
      createSealMedalGroup(
        1.08,
      ),
    );

    this.medalHitbox =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.54,
          36,
        ),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side:
            THREE.DoubleSide,
        }),
      );

    this.medalHitbox.position.z =
      0.11;

    this.medalGroup.add(
      this.medalHitbox,
    );

    this.medalRoot.add(
      this.medalGroup,
    );
  }

  private openMedalCompartment() {
    this.medalAvailable =
      true;

    this.medalGroup.visible =
      true;

    this.medalGroup.scale.setScalar(
      0.45,
    );

    gsap
      .timeline()
      .to(
        this.medalGroup.scale,
        {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.34,
          ease: "back.out(1.8)",
        },
      )
      .call(() => {
        this.onSolved?.();
      });
  }

  private pickUpMedal() {
    if (
      !this.medalAvailable ||
      this.medalPickedUp
    ) {
      return;
    }

    this.medalAvailable =
      false;

    this.medalPickedUp =
      true;

    gsap
      .timeline()
      .to(
        this.medalGroup.position,
        {
          z: 0.58,
          duration: 0.16,
        },
      )
      .to(
        this.medalGroup.scale,
        {
          x: 0.05,
          y: 0.05,
          z: 0.05,
          duration: 0.20,
          ease: "power2.in",
        },
        "<+=0.03",
      )
      .call(() => {
        this.medalGroup.visible =
          false;

        this.onMedalPickedUp?.();
      });
  }


  // ==================================================
  // POINTER
  // ==================================================

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const { clientX, clientY } = event;

    if (
      this.medalAvailable &&
      !this.medalPickedUp &&
      this.medalHitbox &&
      this.pickObject(this.medalHitbox, clientX, clientY)
    ) {
      this.pickUpMedal();
      return;
    }

    if (this.directionSolved) return;

    if (!this.pickObject(this.dialHitbox, clientX, clientY)) return;

    if (!this.gearFree) {
      this.wiggleJammedGear();
      return;
    }

    this.rotatingDial = true;
    this.pointerId = event.pointerId;

    const center = this.getDialScreenCenter();
    this.startPointerAngle = Math.atan2(clientY - center.y, clientX - center.x);
    this.startDialRotation = this.dialGroup.rotation.z;

    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = "grabbing";
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;

    const { clientX, clientY } = event;

    if (this.rotatingDial && event.pointerId === this.pointerId) {
      const center = this.getDialScreenCenter();
      const angle = Math.atan2(clientY - center.y, clientX - center.x);
      // Keep the dial moving in the same visual direction as the drag.
      this.setDialRotation(this.startDialRotation - (angle - this.startPointerAngle));
      return;
    }

    if (this.medalAvailable && this.medalHitbox && this.pickObject(this.medalHitbox, clientX, clientY)) {
      this.canvas.style.cursor = "pointer";
      return;
    }

    if (!this.directionSolved && this.pickObject(this.dialHitbox, clientX, clientY)) {
      this.canvas.style.cursor = "grab";
      return;
    }

    this.canvas.style.cursor = "default";
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.rotatingDial || event.pointerId !== this.pointerId) return;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    this.rotatingDial = false;
    this.pointerId = null;

    const step = Math.PI / 4;
    // Snap to the nearest of 8 directions, keeping whole turns so the snap
    // never spins the gear (and the top dial it drives) the long way round.
    const steps = Math.round(-this.dialGroup.rotation.z / step);
    this.currentDirection = ((steps % 8) + 8) % 8;

    const state = { r: this.dialGroup.rotation.z };
    gsap.to(state, {
      r: -steps * step,
      duration: 0.18,
      ease: "back.out(1.5)",
      onUpdate: () => this.setDialRotation(state.r),
      onComplete: () => this.confirmDirection(),
    });

    this.canvas.style.cursor = "grab";
  };

  // ==================================================
  // HELPERS
  // ==================================================

  private pickObject(
    object:
      THREE.Object3D,
    clientX: number,
    clientY: number,
  ) {
    this.setPointer(
      clientX,
      clientY,
    );

    return (
      this.raycaster.intersectObject(
        object,
        false,
      ).length > 0
    );
  }

  private setPointer(
    clientX: number,
    clientY: number,
  ) {
    const rect =
      this.canvas.getBoundingClientRect();

    this.pointer.x =
      (
        (clientX -
          rect.left) /
        rect.width
      ) *
        2 -
      1;

    this.pointer.y =
      -(
        (
          clientY -
          rect.top
        ) /
        rect.height
      ) *
        2 +
      1;

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera,
    );
  }

  private getDialScreenCenter() {
    const world =
      new THREE.Vector3();

    this.dialGroup.getWorldPosition(
      world,
    );

    world.project(
      this.camera,
    );

    const rect =
      this.canvas.getBoundingClientRect();

    return {
      x:
        rect.left +
        (world.x + 1) *
          0.5 *
          rect.width,

      y:
        rect.top +
        (-world.y + 1) *
          0.5 *
          rect.height,
    };
  }


  // ==================================================
  // PUBLIC
  // ==================================================

  // The NFC log was read: something clicks inside the box.
  public freeGear() {
    this.gearFree = true;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.rotatingDial = false;
      this.pointerId = null;
    }
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);

    gsap.killTweensOf(this.dialGroup.position);
    if (this.confirmButton) gsap.killTweensOf(this.confirmButton.scale);
    if (this.confirmHint) {
      gsap.killTweensOf(this.confirmHint.scale);
      gsap.killTweensOf(this.confirmHint.material);
    }
    gsap.killTweensOf(this.medalGroup.position);
    gsap.killTweensOf(this.medalGroup.scale);
    for (const light of this.progressLights) gsap.killTweensOf(light.scale);

    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });

    this.anchor.remove(this.root);
    this.medalRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.medalAnchor.remove(this.medalRoot);
  }
}
