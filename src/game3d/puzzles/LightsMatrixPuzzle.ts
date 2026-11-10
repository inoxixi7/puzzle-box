import * as THREE from "three";
import { gsap } from "gsap";

import { aluminum, disposeTree, pickObject, smokedGlass } from "./puzzleUtils";
import { PALETTE } from "../palette";

type LightsMatrixPuzzleOptions = {
  anchor: THREE.Group;
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  onSolved?: () => void;
  // Which keys are lit, after power-up and after every press.
  onChange?: (lit: boolean[]) => void;
};

const SIZE = 3;
const KEY = 0.62;
const GAP = 0.16;
// The start pattern is what these presses make from all-dark, so pressing
// them again solves it. On 3×3 every pattern has exactly one solution set.
const SCRAMBLE = [1, 3, 5, 8];

const LIT = 1;
const DIM = 0.08;

// Back face: 3×3 backlit touch keys. Pressing a key flips it and its
// neighbours (up, down, left, right). Clear every light to release the card.
export class LightsMatrixPuzzle {
  private anchor: THREE.Group;
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private options: LightsMatrixPuzzleOptions;

  private root = new THREE.Group();
  private keys: { glow: THREE.Mesh; cap: THREE.Mesh }[] = [];
  private lit: boolean[] = new Array(SIZE * SIZE).fill(false);

  private enabled = false;
  private powered = false;
  private solved = false;

  constructor(options: LightsMatrixPuzzleOptions) {
    this.options = options;
    this.anchor = options.anchor;
    this.canvas = options.canvas;
    this.camera = options.camera;

    this.root.name = "lights-matrix-puzzle";
    this.anchor.add(this.root);

    const span = SIZE * KEY + (SIZE + 1) * GAP;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.7 }),
    );
    back.position.z = 0.03;
    this.root.add(back);

    const frame = aluminum();
    const t = 0.06;
    for (const [w, h, x, y] of [
      [span + t, t, 0, span / 2],
      [span + t, t, 0, -span / 2],
      [t, span + t, span / 2, 0],
      [t, span + t, -span / 2, 0],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frame);
      bar.position.set(x, y, 0.06);
      bar.castShadow = true;
      this.root.add(bar);
    }

    const capMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.35 });
    for (let i = 0; i < SIZE * SIZE; i++) {
      const col = i % SIZE;
      const row = Math.floor(i / SIZE);
      const x = (col - 1) * (KEY + GAP);
      const y = (1 - row) * (KEY + GAP);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(KEY, KEY, 0.05), capMaterial);
      cap.position.set(x, y, 0.06);
      this.root.add(cap);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(KEY * 0.78, KEY * 0.78),
        new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0, depthWrite: false }),
      );
      glow.position.set(x, y, 0.087);
      this.root.add(glow);

      this.keys.push({ glow, cap });
    }

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(span, span), smokedGlass(0.2));
    glass.position.z = 0.1;
    glass.renderOrder = 2;
    this.root.add(glass);

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
  }

  private show(index: number, duration = 0.12) {
    gsap.to(this.keys[index].glow.material, {
      opacity: this.lit[index] ? LIT : DIM,
      duration,
    });
  }

  private neighbours(index: number) {
    const col = index % SIZE;
    const row = Math.floor(index / SIZE);
    const result = [index];
    if (row > 0) result.push(index - SIZE);
    if (row < SIZE - 1) result.push(index + SIZE);
    if (col > 0) result.push(index - 1);
    if (col < SIZE - 1) result.push(index + 1);
    return result;
  }

  public pattern() {
    return [...this.lit];
  }

  private flip(index: number) {
    for (const n of this.neighbours(index)) this.lit[n] = !this.lit[n];
  }

  public powerOn() {
    if (this.powered) return;
    this.powered = true;
    for (const index of SCRAMBLE) this.flip(index);
    this.options.onChange?.(this.pattern());
    // Boot sweep, then the pattern.
    this.keys.forEach((key, i) => {
      gsap
        .timeline({ delay: 0.06 * i })
        .to(key.glow.material, { opacity: LIT, duration: 0.08 })
        .call(() => this.show(i, 0.3), [], "+=0.15");
    });
  }

  private press(index: number) {
    const { cap } = this.keys[index];
    gsap.fromTo(cap.position, { z: 0.04 }, { z: 0.06, duration: 0.15 });
    this.flip(index);
    for (const n of this.neighbours(index)) this.show(n);
    this.options.onChange?.(this.pattern());

    if (this.lit.every((on) => !on)) this.solve();
  }

  private solve() {
    this.solved = true;
    const materials = this.keys.map((k) => k.glow.material);
    gsap
      .timeline({ delay: 0.25 })
      .to(materials, { opacity: LIT, duration: 0.08 })
      .to(materials, { opacity: 0, duration: 0.6 }, "+=0.15")
      .call(() => this.options.onSolved?.());
  }

  private keyAt(event: PointerEvent) {
    return this.keys.findIndex(({ cap }) =>
      pickObject(cap, this.camera, this.canvas, event.clientX, event.clientY),
    );
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled || !this.powered || this.solved) return;
    const index = this.keyAt(event);
    if (index >= 0) this.press(index);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.enabled || !this.powered || this.solved) return;
    this.canvas.style.cursor = this.keyAt(event) >= 0 ? "pointer" : "default";
  };

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    gsap.killTweensOf(this.keys.flatMap((k) => [k.glow.material, k.cap.position]));
    disposeTree(this.root);
  }
}
