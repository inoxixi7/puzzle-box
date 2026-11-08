import * as THREE from "three";
import { gsap } from "gsap";

const OPEN_ANGLE = THREE.MathUtils.degToRad(105);
// Released past this, the lid swings open on its own; below it, it drops back.
const SNAP_ANGLE = THREE.MathUtils.degToRad(30);
// Drag distance per radian: the lid is heavy, so it lags the finger.
const PX_PER_RADIAN = 320;
const LIGHT_MAX = 14;

type BoxLidOptions = {
  // Hinge on the back-top edge. Everything that belongs to the lid is its child.
  pivot: THREE.Group;
  light: THREE.PointLight;
  canvas: HTMLCanvasElement;
  onOpened: () => void;
};

export class BoxLid {
  private pivot: THREE.Group;
  private light: THREE.PointLight;
  private canvas: HTMLCanvasElement;
  private onOpened: () => void;

  private unlocked = false;
  private enabled = false;
  private opened = false;
  private angle = 0;

  private dragId: number | null = null;
  private dragStartY = 0;
  private dragStartAngle = 0;

  constructor(options: BoxLidOptions) {
    this.pivot = options.pivot;
    this.light = options.light;
    this.canvas = options.canvas;
    this.onOpened = options.onOpened;

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  public get isUnlocked() {
    return this.unlocked;
  }

  public get isOpen() {
    return this.opened;
  }

  public unlock() {
    this.unlocked = true;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.dragId = null;
  }

  private setAngle(angle: number) {
    this.angle = angle;
    this.pivot.rotation.x = -angle;
    this.light.intensity = LIGHT_MAX * Math.min(1, angle / SNAP_ANGLE);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled || !this.unlocked || this.opened) return;
    if (this.dragId !== null) return;

    gsap.killTweensOf(this);
    this.dragId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragStartAngle = this.angle;
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.dragId) return;

    // Dragging up lifts the front edge.
    const angle = this.dragStartAngle + (this.dragStartY - event.clientY) / PX_PER_RADIAN;
    this.setAngle(THREE.MathUtils.clamp(angle, 0, OPEN_ANGLE));
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragId) return;
    this.dragId = null;

    if (this.angle >= SNAP_ANGLE) {
      this.open();
      return;
    }

    gsap.to(this, {
      angle: 0,
      duration: 0.45,
      ease: "bounce.out",
      onUpdate: () => this.setAngle(this.angle),
    });
  };

  public open() {
    if (this.opened) return;
    this.opened = true;
    this.dragId = null;

    gsap.killTweensOf(this);
    gsap.to(this, {
      angle: OPEN_ANGLE,
      duration: 0.8,
      ease: "back.out(1.6)",
      onUpdate: () => this.setAngle(this.angle),
      onComplete: () => this.onOpened(),
    });
  }

  public dispose() {
    gsap.killTweensOf(this);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
  }
}
