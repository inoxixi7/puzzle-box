import * as THREE from "three";
import { gsap } from "gsap";

import type { InventoryItemId } from "../inventory/items";
import {
  drawArrow,
  drawCard,
  drawDial,
  drawToken,
  drawGrid,
  drawLock,
  drawPad,
  drawPips,
  drawPower,
} from "./einkIcons";
import {
  aluminum,
  createLed,
  disposeTree,
  pickObject,
  setLed,
  smokedGlass,
} from "./puzzleUtils";
import { createToken } from "./finale";
import { PALETTE } from "../palette";
import { chime, tick } from "../sound";

type NfcReaderPuzzleOptions = {
  anchor: THREE.Group;
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  getSelectedItem: () => InventoryItemId | null;
  consumeItem: (item: InventoryItemId) => boolean;
  onSolved?: () => void;
  // The key token was read: the last step of the game.
  onTokenRead?: () => void;
};

type ScreenState = "sleep" | "locked" | "ready" | "log" | "token";

const SCREEN = { x: -0.8, y: 0.15, width: 2.0, height: 1.36 };
const PAD = { x: 1.25, y: 0.15, radius: 0.5 };
// The log's clue for the right-face knob, drawn as three dials: ↗ ↓ ←.
const SEQUENCE_ANGLES = [-Math.PI / 4, Math.PI / 2, Math.PI];

// Smoked-glass panel on the left face: an e-ink screen and a hidden NFC pad.
// Dead until the maze powers the box; the access card makes it print the log.
export class NfcReaderPuzzle {
  private anchor: THREE.Group;
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private options: NfcReaderPuzzleOptions;

  private root = new THREE.Group();
  private screenCanvas = document.createElement("canvas");
  private screenTexture: THREE.CanvasTexture;
  private padRing: THREE.Mesh;
  private padIcon: THREE.Mesh;
  private padHitbox: THREE.Mesh;
  private card: THREE.Mesh;
  private token: THREE.Group;
  // After the card: idle until the token comes out of the inner case.
  private wantsToken = false;
  private breathing: gsap.core.Tween | null = null;

  private enabled = false;
  private powered = false;
  private solved = false;
  // Mirror of the back-panel matrix; the card is held until it is all dark.
  private rearPattern: boolean[] = new Array(9).fill(false);

  constructor(options: NfcReaderPuzzleOptions) {
    this.options = options;
    this.anchor = options.anchor;
    this.canvas = options.canvas;
    this.camera = options.camera;

    this.root.name = "nfc-reader-puzzle";
    this.anchor.add(this.root);

    this.screenCanvas.width = 600;
    this.screenCanvas.height = 408;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.drawScreen("sleep");

    this.createPanel();
    this.padRing = this.createPadRing();
    this.padIcon = this.createPadIcon();
    this.padHitbox = new THREE.Mesh(
      new THREE.CircleGeometry(PAD.radius + 0.15, 32),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.padHitbox.position.set(PAD.x, PAD.y, 0.2);
    this.root.add(this.padHitbox);
    this.card = this.createCard();
    this.token = createToken().group;
    this.token.position.set(PAD.x, PAD.y, 0.8);
    this.token.visible = false;
    this.root.add(this.token);

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
  }

  private createPanel() {
    const width = 3.9;
    const height = 2.5;

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.7 }),
    );
    back.position.z = 0.03;
    this.root.add(back);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN.width, SCREEN.height),
      // E-ink reflects room light; it does not glow.
      new THREE.MeshStandardMaterial({ map: this.screenTexture, roughness: 0.92 }),
    );
    screen.position.set(SCREEN.x, SCREEN.y, 0.04);
    this.root.add(screen);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), smokedGlass(0.42));
    glass.position.z = 0.12;
    glass.renderOrder = 2;
    this.root.add(glass);

    // Thin machined frame.
    const frame = aluminum();
    const t = 0.06;
    for (const [w, h, x, y] of [
      [width + t, t, 0, height / 2],
      [width + t, t, 0, -height / 2],
      [t, height + t, width / 2, 0],
      [t, height + t, -width / 2, 0],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), frame);
      bar.position.set(x, y, 0.07);
      bar.castShadow = true;
      this.root.add(bar);
    }
  }

  private createPadRing() {
    const ring = createLed(new THREE.RingGeometry(PAD.radius - 0.03, PAD.radius, 64));
    ring.position.set(PAD.x, PAD.y, 0.045);
    this.root.add(ring);
    return ring;
  }

  private createPadIcon() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(40, 64, 16 + i * 18, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    const icon = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: PALETTE.amber,
        emissiveMap: texture,
        emissiveIntensity: 0,
        alphaMap: texture,
        transparent: true,
      }),
    );
    icon.position.set(PAD.x, PAD.y, 0.046);
    this.root.add(icon);
    return icon;
  }

  private createCard() {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1.15, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xe9e8e4, roughness: 0.45 }),
    );
    card.position.set(PAD.x, PAD.y, 0.8);
    card.visible = false;
    this.root.add(card);
    return card;
  }

  private drawScreen(state: ScreenState, inverted = false) {
    const ctx = this.screenCanvas.getContext("2d")!;
    const { width, height } = this.screenCanvas;
    const paper = inverted ? "#26262a" : "#d8d7d0";
    const ink = inverted ? "#d8d7d0" : "#26262a";

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    // No words anywhere: every screen is pictograms.
    if (state === "sleep") {
      // E-ink keeps its last image with the power off.
      ctx.globalAlpha = 0.45;
      drawPower(ctx, width / 2, height / 2, 60);
      ctx.globalAlpha = 1;
    } else if (state === "locked") {
      // [back panel now] → [all dark] → card unlocked.
      const cell = 34;
      const y = height / 2 - 60;
      const w = drawGrid(ctx, 30, y, cell, this.rearPattern);
      drawArrow(ctx, 30 + w + 20, height / 2, 30 + w + 80);
      drawGrid(ctx, 30 + w + 100, y, cell, new Array(9).fill(false));
      drawArrow(ctx, 2 * w + 150, height / 2, 2 * w + 210);
      drawCard(ctx, 2 * w + 225, height / 2 - 25, 105, 66);
      drawLock(ctx, 2 * w + 278, height / 2 - 100, 44, true);
    } else if (state === "ready") {
      // Card → pad.
      drawCard(ctx, 60, height / 2 - 60, 190, 120);
      drawArrow(ctx, 280, height / 2, 380);
      drawPad(ctx, 480, height / 2, 75);
    } else if (state === "token") {
      // The token read, under an open lock.
      drawToken(ctx, width / 2, height / 2 + 30, 110);
      drawLock(ctx, width / 2, 36, 40, true);
    } else {
      // Knob unlocked; turn it to these three positions, in this order.
      drawLock(ctx, width / 2, 36, 40, true);
      SEQUENCE_ANGLES.forEach((angle, i) => {
        const x = 110 + i * 190;
        drawDial(ctx, x, 230, 72, angle);
        drawPips(ctx, x, 350, i + 1);
      });
    }

    this.screenTexture.needsUpdate = true;
  }

  // Full black/white flashes before the new image, like a real e-ink refresh.
  private refreshScreen(state: ScreenState) {
    return gsap
      .timeline()
      .call(() => this.drawScreen(state, true))
      .call(() => this.drawScreen(state, false), [], "+=0.12")
      .call(() => this.drawScreen(state, true), [], "+=0.12")
      .call(() => this.drawScreen(state, false), [], "+=0.12");
  }

  public powerOn(rearPattern: boolean[]) {
    if (this.powered) return;
    this.powered = true;
    this.rearPattern = [...rearPattern];
    this.refreshScreen("locked");
  }

  // Partial refresh: only the mirrored grid changes, no full flash.
  public setRearPattern(pattern: boolean[]) {
    this.rearPattern = [...pattern];
    if (this.powered) this.drawScreen("locked");
  }

  // The card is out: the pad wakes up and asks for it.
  public cardReleased() {
    this.refreshScreen("ready");
    setLed(this.padIcon, 0.6, 0.6);
    // Breathes until the card is read (keeps rendering while it does).
    this.breathing = gsap.fromTo(
      this.padRing.material as THREE.MeshStandardMaterial,
      { emissiveIntensity: 0.2 },
      { emissiveIntensity: 1.6, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" },
    );
  }

  private readCard() {
    this.solved = true;
    this.breathing?.kill();
    this.card.visible = true;

    gsap
      .timeline()
      .fromTo(this.card.position, { z: 1.4 }, { z: 0.2, duration: 0.45, ease: "power2.out" })
      .call(() => {
        tick();
        setLed(this.padRing, 2.6, 0.1);
        this.refreshScreen("log");
      })
      .to(this.card.position, { z: 1.4, duration: 0.4, ease: "power2.in" }, "+=0.9")
      .call(() => {
        this.card.visible = false;
        setLed(this.padIcon, 0, 0.4);
        this.options.onSolved?.();
      });
  }

  // The token is out: the pad, quiet since the card, breathes in the
  // token's blue. That colour is the only clue where the token goes.
  public tokenReleased() {
    this.wantsToken = true;
    for (const led of [this.padRing, this.padIcon]) {
      (led.material as THREE.MeshStandardMaterial).emissive.set(PALETTE.tokenBlue);
    }
    setLed(this.padIcon, 0.6, 0.6);
    this.breathing = gsap.fromTo(
      this.padRing.material as THREE.MeshStandardMaterial,
      { emissiveIntensity: 0.2 },
      { emissiveIntensity: 1.6, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" },
    );
  }

  private readToken() {
    this.wantsToken = false;
    this.breathing?.kill();
    this.token.visible = true;
    gsap
      .timeline()
      .fromTo(this.token.position, { z: 1.4 }, { z: 0.2, duration: 0.6, ease: "power2.out" })
      .call(() => {
        chime();
        setLed(this.padRing, 2.6, 0.1);
        setLed(this.padIcon, 0, 0.4);
        this.refreshScreen("token");
      })
      // Stays on the pad, its ring turning slowly, for the ending.
      .to(this.token.rotation, { z: Math.PI * 2, duration: 6, ease: "none", repeat: -1 }, "<")
      .call(() => this.options.onTokenRead?.(), [], 0.9);
  }

  // Tapped without the card: the ring blinks to say "something goes here".
  private nudge() {
    tick();
    gsap.fromTo(
      this.padIcon.material as THREE.MeshStandardMaterial,
      { emissiveIntensity: 2 },
      { emissiveIntensity: 0.6, duration: 0.5 },
    );
  }

  private get listening() {
    return this.enabled && this.powered && (!this.solved || this.wantsToken);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.listening) return;
    if (!pickObject(this.padHitbox, this.camera, this.canvas, event.clientX, event.clientY)) return;

    if (this.wantsToken) {
      if (this.options.getSelectedItem() === "key-token" && this.options.consumeItem("key-token")) this.readToken();
      else this.nudge();
      return;
    }

    if (
      this.options.getSelectedItem() === "nfc-card" &&
      this.options.consumeItem("nfc-card")
    ) {
      this.readCard();
    } else {
      this.nudge();
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.listening) return;
    const hit = pickObject(this.padHitbox, this.camera, this.canvas, event.clientX, event.clientY);
    this.canvas.style.cursor = hit ? "pointer" : "default";
  };

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.breathing?.kill();
    gsap.killTweensOf([
      this.card.position,
      this.token.position,
      this.token.rotation,
      this.padRing.material,
      this.padIcon.material,
    ]);
    disposeTree(this.root);
  }
}
