import * as THREE from "three";
import { gsap } from "gsap";

import type { InventoryItemId } from "../inventory/items";
import {
  createSealMedalGroup,
  createSymbolMesh,
  FINAL_SYMBOL_SEQUENCE,
  PUCK_TAB_ANGLE,
  type SealSymbol,
} from "./SealMedal";
import { aluminum, disposeTree, pickObject, screenCenter } from "./puzzleUtils";
import { PALETTE } from "../palette";
import { clunk, tick } from "../sound";

type TouchKeysPuzzleOptions = {
  anchor: THREE.Group;
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  getSelectedItem: () => InventoryItemId | null;
  consumeItem: (item: InventoryItemId) => boolean;
  onSolved?: () => void;
};

// Symbol ids as on the puck: 0 △, 1 ○, 2 □, 3 ◇.
const SYMBOLS: SealSymbol[] = ["triangle", "circle", "square", "diamond"];
// Left to right on the lid; not the order they are pressed in.
const KEY_ORDER = [0, 2, 1, 3];
const DOCK = new THREE.Vector2(-1.7, 0);
const KEY_X0 = 0.25;
const KEY_GAP = 0.78;

const PUCK_SCALE = 1.6;
// Docked at a random-looking angle; the tab must be turned to the mark.
const PUCK_START_ROTATION = 2.3;
const ALIGN_TOLERANCE = 0.22;

const KEY_IDLE = 0.55;
const KEY_LIT = 2.4;

// Wood-looking lid with capacitive keys under the veneer. The magnetic puck
// docks in the ring; turned until its tab meets the mark, the hall sensor
// wakes the keys. The order is the puck's symbols read clockwise from the tab.
export class TouchKeysPuzzle {
  private anchor: THREE.Group;
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private options: TouchKeysPuzzleOptions;

  private root = new THREE.Group();
  private dockHitbox: THREE.Mesh;
  private puck: THREE.Group;
  private keys: { id: number; glow: THREE.Mesh; hitbox: THREE.Mesh }[] = [];

  private enabled = false;
  private docked = false;
  private awake = false;
  private turnPointer: number | null = null;
  private startPointerAngle = 0;
  private startPuckRotation = 0;
  private solved = false;
  private judging = false;
  private entry: number[] = [];

  constructor(options: TouchKeysPuzzleOptions) {
    this.options = options;
    this.anchor = options.anchor;
    this.canvas = options.canvas;
    this.camera = options.camera;

    this.root.name = "touch-keys-puzzle";
    this.anchor.add(this.root);

    // Flush machined ring: where the puck goes.
    const dockRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.74, 64), aluminum());
    dockRing.position.set(DOCK.x, DOCK.y, 0.025);
    this.root.add(dockRing);

    // Engraved mark above the ring: where the tab has to point.
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.14), aluminum());
    mark.position.set(DOCK.x, DOCK.y + 0.86, 0.025);
    this.root.add(mark);

    this.dockHitbox = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 32),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.dockHitbox.position.set(DOCK.x, DOCK.y, 0.06);
    this.root.add(this.dockHitbox);

    this.puck = createSealMedalGroup(PUCK_SCALE);
    this.puck.position.set(DOCK.x, DOCK.y, 0.06);
    this.puck.visible = false;
    this.root.add(this.puck);

    KEY_ORDER.forEach((id, i) => {
      const x = KEY_X0 + i * KEY_GAP;
      const glow = createSymbolMesh(SYMBOLS[id], 0.17, 0x000000);
      // Light through the veneer: invisible until lit.
      (glow.material as THREE.Material).dispose();
      glow.material = new THREE.MeshBasicMaterial({
        color: PALETTE.amber,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      glow.position.set(x, 0, 0.024);
      this.root.add(glow);

      const hitbox = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 24),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitbox.position.set(x, 0, 0.06);
      this.root.add(hitbox);

      this.keys.push({ id, glow, hitbox });
    });

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  private setGlow(key: { glow: THREE.Mesh }, level: number, duration = 0.2) {
    // Opacity stands in for brightness; past 1 it only lingers longer.
    return gsap.to(key.glow.material, { opacity: Math.min(1, level / KEY_LIT), duration });
  }

  private dockPuck() {
    clunk();
    this.puck.visible = true;
    this.puck.rotation.z = PUCK_START_ROTATION;
    gsap
      .timeline()
      .fromTo(this.puck.position, { z: 0.9 }, { z: 0.06, duration: 0.3, ease: "power3.in" })
      .to(this.root.position, { z: -0.015, duration: 0.05, yoyo: true, repeat: 1 })
      .call(() => {
        this.docked = true;
      });
  }

  // Signed angle between the tab and the mark (0 = aligned).
  private tabOffset() {
    const angle = PUCK_TAB_ANGLE + this.puck.rotation.z;
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  private checkAlignment() {
    if (Math.abs(this.tabOffset()) > ALIGN_TOLERANCE) return;
    this.awake = true;
    tick();
    gsap.to(this.puck.rotation, { z: this.puck.rotation.z - this.tabOffset(), duration: 0.12 });
    this.keys.forEach((key, i) =>
      gsap.delayedCall(0.3 + 0.12 * i, () => this.setGlow(key, KEY_IDLE, 0.4)),
    );
  }

  private pointerAngle(event: PointerEvent) {
    const center = screenCenter(this.puck, this.camera, this.canvas);
    return Math.atan2(event.clientY - center.y, event.clientX - center.x);
  }

  // Every press lights its key; only a full four-key entry is judged, so
  // guessing key by key gives nothing away.
  private press(key: (typeof this.keys)[number]) {
    if (this.judging) return;
    tick();
    this.entry.push(key.id);
    this.setGlow(key, KEY_LIT, 0.08);
    if (this.entry.length < FINAL_SYMBOL_SEQUENCE.length) return;

    const correct = this.entry.every((id, i) => id === FINAL_SYMBOL_SEQUENCE[i]);
    this.entry = [];
    if (correct) {
      this.solve();
      return;
    }

    this.judging = true;
    const materials = this.keys.map((k) => k.glow.material);
    gsap
      .timeline({ delay: 0.25 })
      .to(materials, { opacity: 0, duration: 0.12 })
      .to(materials, { opacity: KEY_IDLE / KEY_LIT, duration: 0.3 }, "+=0.2")
      .call(() => {
        this.judging = false;
      });
  }

  private solve() {
    this.solved = true;
    const materials = this.keys.map((k) => k.glow.material);
    gsap
      .timeline()
      .to(materials, { opacity: 0.15, duration: 0.1 }, "+=0.25")
      .to(materials, { opacity: 1, duration: 0.1 })
      .to(materials, { opacity: 0.15, duration: 0.1 })
      .to(materials, { opacity: 1, duration: 0.1 })
      .to(materials, { opacity: 0, duration: 0.8 }, "+=0.3")
      .call(() => this.options.onSolved?.(), [], "-=0.6");
  }

  private hits(object: THREE.Object3D, event: PointerEvent) {
    return pickObject(object, this.camera, this.canvas, event.clientX, event.clientY);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled || this.solved) return;

    if (!this.puck.visible && this.hits(this.dockHitbox, event)) {
      if (
        this.options.getSelectedItem() === "magnet-puck" &&
        this.options.consumeItem("magnet-puck")
      ) {
        this.dockPuck();
      }
      return;
    }

    if (this.docked && !this.awake && this.hits(this.dockHitbox, event)) {
      this.turnPointer = event.pointerId;
      this.startPointerAngle = this.pointerAngle(event);
      this.startPuckRotation = this.puck.rotation.z;
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (!this.awake) return;
    const key = this.keys.find((k) => this.hits(k.hitbox, event));
    if (key) this.press(key);
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.turnPointer) return;
    this.turnPointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.checkAlignment();
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.enabled || this.solved) return;
    if (event.pointerId === this.turnPointer) {
      // Screen y points down, so a clockwise drag is a negative turn.
      this.puck.rotation.z =
        this.startPuckRotation - (this.pointerAngle(event) - this.startPointerAngle);
      return;
    }
    const overDock =
      (!this.puck.visible || (this.docked && !this.awake)) && this.hits(this.dockHitbox, event);
    const overKey = this.awake && this.keys.some((k) => this.hits(k.hitbox, event));
    this.canvas.style.cursor = overDock || overKey ? "pointer" : "default";
  };

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.turnPointer = null;
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    gsap.killTweensOf([this.puck.position, this.puck.rotation, this.root.position, ...this.keys.map((k) => k.glow.material)]);
    disposeTree(this.root);
  }
}
