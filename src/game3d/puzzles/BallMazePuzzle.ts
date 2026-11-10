import * as THREE from "three";
import { gsap } from "gsap";

import {
  aluminum,
  createLed,
  disposeTree,
  graphite,
  pickObject,
  screenCenter,
  setLed,
  smokedGlass,
} from "./puzzleUtils";
import { PALETTE, css } from "../palette";
import { clunk, tick } from "../sound";

type BallMazePuzzleOptions = {
  anchor: THREE.Group;
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  // The ball dropped into the hole and closed the circuit.
  onPowered?: () => void;
  onCardPickedUp?: () => void;
};

// 7×7 tilt maze: the ball rolls with real gravity until a wall stops it.
// Turning the disk 90° at a time, the shortest way in is eleven turns;
// turning one way only never gets there. The trap hole drops the ball back
// to the start through a channel underneath.
const N = 7;
const CELL = 0.3;
// Walls between neighbouring cells: [row, col, row2, col2]; row 0 is the top.
const WALLS: [number, number, number, number][] = [
  [0, 1, 1, 1],
  [0, 2, 1, 2],
  [1, 0, 2, 0],
  [1, 2, 1, 3],
  [1, 2, 2, 2],
  [1, 3, 1, 4],
  [1, 3, 2, 3],
  [1, 5, 2, 5],
  [2, 2, 3, 2],
  [2, 5, 2, 6],
  [4, 0, 5, 0],
  [4, 3, 4, 4],
  [4, 3, 5, 3],
  [4, 6, 5, 6],
  [5, 0, 6, 0],
  [5, 1, 5, 2],
  [5, 4, 5, 5],
  [5, 5, 5, 6],
  [6, 0, 6, 1],
  [6, 2, 6, 3],
];
const START: [number, number] = [0, 0];
const HOLE: [number, number] = [3, 3];
const TRAP: [number, number] = [6, 5];

const DISK_RADIUS = 1.55;
const MAZE_CENTER = new THREE.Vector2(-1.25, 0.2);
const DRAWER_POSITION = new THREE.Vector2(1.8, -1.05);
const BALL_RADIUS = 0.1;
const FLOOR_Z = 0.04;
// Gravity must lean this far along an axis before the ball sets off.
const ROLL_THRESHOLD = 0.62;

const cellPosition = (row: number, col: number) =>
  new THREE.Vector2((col - (N - 1) / 2) * CELL, ((N - 1) / 2 - row) * CELL);

const hasWall = (a: [number, number], b: [number, number]) =>
  WALLS.some(
    ([r1, c1, r2, c2]) =>
      (r1 === a[0] && c1 === a[1] && r2 === b[0] && c2 === b[1]) ||
      (r1 === b[0] && c1 === b[1] && r2 === a[0] && c2 === a[1]),
  );

export class BallMazePuzzle {
  private anchor: THREE.Group;
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private options: BallMazePuzzleOptions;

  private root = new THREE.Group();
  private disk = new THREE.Group();
  private ball: THREE.Mesh;
  private glass: THREE.Mesh;
  private holeLed: THREE.Mesh;
  private drawer = new THREE.Group();
  private card: THREE.Mesh;

  private cell: [number, number] = [...START];
  private rolling = false;
  private powered = false;
  private cardAvailable = false;

  private enabled = false;
  private pointerId: number | null = null;
  private startPointerAngle = 0;
  private startDiskAngle = 0;

  constructor(options: BallMazePuzzleOptions) {
    this.options = options;
    this.anchor = options.anchor;
    this.canvas = options.canvas;
    this.camera = options.camera;

    this.root.name = "ball-maze-puzzle";
    this.anchor.add(this.root);

    this.createMaze();
    this.ball = this.createBall();
    this.glass = this.createGlass();
    this.holeLed = this.disk.getObjectByName("hole-led") as THREE.Mesh;
    this.card = this.createDrawer();

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  private createMaze() {
    this.disk.position.set(MAZE_CENTER.x, MAZE_CENTER.y, 0);
    this.root.add(this.disk);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(DISK_RADIUS + 0.04, 0.035, 12, 96),
      aluminum(),
    );
    bezel.position.set(MAZE_CENTER.x, MAZE_CENTER.y, 0.04);
    this.root.add(bezel);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(DISK_RADIUS, 96), graphite(0x1d1e21));
    floor.position.z = FLOOR_Z - 0.005;
    floor.receiveShadow = true;
    this.disk.add(floor);

    // Fine engraved grid so the cells read even where no wall is.
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(N * CELL, N * CELL),
      new THREE.MeshStandardMaterial({
        map: this.createGridTexture(),
        transparent: true,
        roughness: 0.6,
      }),
    );
    grid.position.z = FLOOR_Z;
    this.disk.add(grid);

    const wallMaterial = aluminum(0xb9bec4);
    const wallHeight = 0.1;
    const thickness = 0.035;
    const addWall = (x: number, y: number, horizontal: boolean, length = CELL + thickness) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? length : thickness, horizontal ? thickness : length, wallHeight),
        wallMaterial,
      );
      wall.position.set(x, y, FLOOR_Z + wallHeight / 2);
      wall.castShadow = true;
      this.disk.add(wall);
    };

    const half = (N * CELL) / 2;
    for (const sign of [-1, 1]) {
      addWall(0, sign * half, true, N * CELL + thickness);
      addWall(sign * half, 0, false, N * CELL + thickness);
    }

    for (const [r1, c1, r2, c2] of WALLS) {
      const a = cellPosition(r1, c1);
      const b = cellPosition(r2, c2);
      // A wall between vertical neighbours lies horizontally, and vice versa.
      addWall((a.x + b.x) / 2, (a.y + b.y) / 2, c1 === c2);
    }

    const holePosition = cellPosition(...HOLE);
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_RADIUS * 1.1, 32),
      new THREE.MeshBasicMaterial({ color: 0x050505 }),
    );
    hole.position.set(holePosition.x, holePosition.y, FLOOR_Z + 0.003);
    this.disk.add(hole);

    const holeLed = createLed(new THREE.RingGeometry(BALL_RADIUS * 1.15, BALL_RADIUS * 1.45, 40));
    holeLed.name = "hole-led";
    holeLed.position.set(holePosition.x, holePosition.y, FLOOR_Z + 0.004);
    this.disk.add(holeLed);

    // The trap looks just like the real hole, minus the light ring.
    const trapPosition = cellPosition(...TRAP);
    const trap = hole.clone();
    trap.position.set(trapPosition.x, trapPosition.y, FLOOR_Z + 0.003);
    this.disk.add(trap);
  }

  private createGridTexture() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      const p = (i / N) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createBall() {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xe6e9ed, metalness: 1, roughness: 0.12 }),
    );
    const start = cellPosition(...START);
    ball.position.set(start.x, start.y, FLOOR_Z + BALL_RADIUS);
    ball.castShadow = true;
    this.disk.add(ball);
    return ball;
  }

  private createGlass() {
    // Fixed over the turning disk; also the drag target.
    const glass = new THREE.Mesh(new THREE.CircleGeometry(DISK_RADIUS, 96), smokedGlass(0.08));
    glass.position.set(MAZE_CENTER.x, MAZE_CENTER.y, 0.2);
    glass.renderOrder = 2;
    this.root.add(glass);
    return glass;
  }

  // Card dispenser: an aluminium block with a slot; the card rises out of it.
  private createDrawer() {
    this.drawer.position.set(DRAWER_POSITION.x, DRAWER_POSITION.y, 0);
    this.root.add(this.drawer);

    const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.56, 0.16), aluminum());
    block.position.z = 0.08;
    block.castShadow = true;
    this.drawer.add(block);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.002), graphite(0x0a0a0a));
    slot.position.set(0, 0.281, 0.08);
    slot.rotation.x = Math.PI / 2;
    this.drawer.add(slot);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.03, 0.02), graphite(0x0a0a0a));
    edge.position.set(0, 0.2, 0.161);
    this.drawer.add(edge);

    const cardSide = graphite(0xe9e8e4);
    const card = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.02), [
      cardSide,
      cardSide,
      cardSide,
      cardSide,
      new THREE.MeshStandardMaterial({ map: this.createCardTexture(), roughness: 0.45 }),
      cardSide,
    ]);
    // Hidden inside the block until it is pushed out.
    card.position.set(0, 0, 0.08);
    this.drawer.add(card);
    return card;
  }

  private createCardTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ecebe7";
    ctx.fillRect(0, 0, 320, 200);
    // Contactless waves.
    ctx.strokeStyle = css(PALETTE.graphiteLight);
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(70, 100, 24 + i * 22, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    }
    ctx.fillStyle = css(PALETTE.amber);
    ctx.fillRect(200, 40, 80, 8);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Gravity in the disk's plane, in disk coordinates.
  private getGravity() {
    const q = this.disk.getWorldQuaternion(new THREE.Quaternion()).invert();
    return new THREE.Vector3(0, -1, 0).applyQuaternion(q);
  }

  // Called every rendered frame: the ball answers to the box's real tilt,
  // so it also moves when the whole box is turned.
  public update() {
    if (this.rolling || this.powered) return;

    const g = this.getGravity();
    let dRow = 0;
    let dCol = 0;
    if (Math.abs(g.y) >= Math.abs(g.x)) {
      if (Math.abs(g.y) < ROLL_THRESHOLD) return;
      dRow = g.y < 0 ? 1 : -1;
    } else {
      if (Math.abs(g.x) < ROLL_THRESHOLD) return;
      dCol = g.x > 0 ? 1 : -1;
    }

    const next: [number, number] = [this.cell[0] + dRow, this.cell[1] + dCol];
    if (next[0] < 0 || next[0] >= N || next[1] < 0 || next[1] >= N) return;
    if (hasWall(this.cell, next)) return;

    this.rolling = true;
    const target = cellPosition(...next);
    gsap.to(this.ball.position, {
      x: target.x,
      y: target.y,
      duration: 0.085,
      ease: "none",
      onComplete: () => {
        this.cell = next;
        this.rolling = false;
        if (next[0] === HOLE[0] && next[1] === HOLE[1]) this.drop();
        else if (next[0] === TRAP[0] && next[1] === TRAP[1]) this.fallThroughTrap();
      },
    });
  }

  // Down the trap, along the channel, and back up at the start.
  private fallThroughTrap() {
    this.rolling = true;
    clunk();
    const start = cellPosition(...START);
    gsap
      .timeline()
      .to(this.ball.position, { z: FLOOR_Z - 0.05, duration: 0.15, ease: "power2.in" })
      .set(this.ball, { visible: false })
      .set(this.ball.position, { x: start.x, y: start.y }, "+=0.8")
      .set(this.ball, { visible: true })
      .to(this.ball.position, { z: FLOOR_Z + BALL_RADIUS, duration: 0.2, ease: "back.out(2)" })
      .call(() => {
        this.cell = [...START];
        this.rolling = false;
      });
  }

  // Restoring a saved game: the ball goes straight into the hole.
  public skipToPowered() {
    this.cell = [...HOLE];
    const hole = cellPosition(...HOLE);
    this.ball.position.x = hole.x;
    this.ball.position.y = hole.y;
    this.drop();
  }

  public skipPickUpCard() {
    this.pickUpCard();
  }

  private drop() {
    this.powered = true;
    this.pointerId = null;

    gsap
      .timeline()
      .to(this.ball.position, { z: FLOOR_Z - 0.02, duration: 0.18, ease: "power2.in" })
      .to(this.ball.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.1 }, "<")
      .call(() => {
        clunk();
        setLed(this.holeLed, 2.4, 0.15);
        this.options.onPowered?.();
      });
  }

  // The back-panel matrix was cleared: the dispenser pushes the card out.
  public releaseCard() {
    gsap.to(this.card.position, {
      y: 0.42,
      duration: 0.6,
      ease: "power3.out",
      onComplete: () => {
        this.cardAvailable = true;
      },
    });
  }

  private pickUpCard() {
    this.cardAvailable = false;
    tick();
    gsap
      .timeline()
      .to(this.card.position, { y: 1.1, z: 0.4, duration: 0.35, ease: "power2.out" })
      .to(this.card.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.2, ease: "power2.in" })
      .call(() => {
        this.card.visible = false;
        this.options.onCardPickedUp?.();
      });
  }

  private pointerAngle(event: PointerEvent) {
    const center = screenCenter(this.disk, this.camera, this.canvas);
    return Math.atan2(event.clientY - center.y, event.clientX - center.x);
  }

  private hits(object: THREE.Object3D, event: PointerEvent) {
    return pickObject(object, this.camera, this.canvas, event.clientX, event.clientY);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled) return;

    if (this.cardAvailable && this.hits(this.card, event)) {
      this.pickUpCard();
      return;
    }

    if (this.powered || !this.hits(this.glass, event)) return;

    this.pointerId = event.pointerId;
    this.startPointerAngle = this.pointerAngle(event);
    this.startDiskAngle = this.disk.rotation.z;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = "grabbing";
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;

    if (event.pointerId === this.pointerId) {
      // Screen y points down, so a clockwise drag is a negative turn.
      this.disk.rotation.z = this.startDiskAngle - (this.pointerAngle(event) - this.startPointerAngle);
      return;
    }

    if (this.cardAvailable && this.hits(this.card, event)) {
      this.canvas.style.cursor = "pointer";
    } else if (!this.powered && this.hits(this.glass, event)) {
      this.canvas.style.cursor = "grab";
    } else {
      this.canvas.style.cursor = "default";
    }
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.canvas.style.cursor = "grab";
  };

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.pointerId = null;
  }

  public dispose() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    gsap.killTweensOf([this.ball, this.ball.position, this.ball.scale, this.drawer.position, this.card.position, this.card.scale]);
    disposeTree(this.root);
  }
}
