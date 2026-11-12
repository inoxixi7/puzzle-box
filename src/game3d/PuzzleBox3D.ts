import * as THREE from "three";
import { gsap } from "gsap";

import {
  BOX_FACE_NAMES,
  createFaceAnchors,
  type BoxDimensions,
  type BoxFaceName,
  type FocusTarget,
} from "./BoxFace";

import {
  createBoxMaterials,
  type BoxMaterials,
} from "./BoxMaterials";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { BoxRotationController } from "./BoxRotationController";
import { BoxFaceFocusController } from "./BoxFaceFocusController";
import { BoxLid } from "./BoxLid";
import { BallMazePuzzle } from "./puzzles/BallMazePuzzle";
import { NfcReaderPuzzle } from "./puzzles/NfcReaderPuzzle";
import { LightsMatrixPuzzle } from "./puzzles/LightsMatrixPuzzle";
import { CornerGearPuzzle } from "./puzzles/CornerGearPuzzle";
import { InteriorPuzzle, createGearClueTexture } from "./puzzles/InteriorPuzzle";
import { drawPips, drawToken } from "./puzzles/einkIcons";
import { TouchKeysPuzzle } from "./puzzles/TouchKeysPuzzle";
import { createLed, setLed } from "./puzzles/puzzleUtils";
import type { InventoryItemId } from "./inventory/items";
import { PALETTE } from "./palette";
import { chime, hush, shimmer } from "./sound";

// Phones / tablets get lighter rendering settings.
const IS_TOUCH_DEVICE =
  typeof window !== "undefined" &&
  window.matchMedia(
    "(pointer: coarse)",
  ).matches;

// Camera distances tuned for a desktop window. They are minimums:
// on narrow screens (phone portrait) the camera moves back further
// so the whole box / face still fits.
const OVERVIEW_CAMERA_Z = 11.8;
const FOCUS_CAMERA_Z = 9.6;

// Screen area the box needs in the overview (any rotation), in world units.
const OVERVIEW_FIT_WIDTH = 8.6;
const OVERVIEW_FIT_HEIGHT = 7.6;

// Extra room around a focused face.
const FOCUS_FIT_MARGIN = 1.06;

// How long to keep rendering after the last pointer / key input.
// Puzzle handlers update the scene synchronously, so this only needs
// to cover a few frames.
const INPUT_RENDER_MS = 250;

// Shell thickness of the now hollow box.
const WALL = 0.35;
const LID_THICKNESS = 0.3;
// Eased edges on the wood and the base, so they catch a line of light.
const EDGE_RADIUS = 0.045;
// False floor inside, above the front drawer.
const FALSE_FLOOR_Y = -0.55;

// Aluminium base, set in under the body so a shadow line separates them.
const PLINTH_HEIGHT = 0.5;
const PLINTH_INSET = 0.14;

// Ring 3 on the right face: the knob, and the drawer that gives the puck.
const KNOB_POSITION = new THREE.Vector3(-0.85, 0.35, 0);
const PUCK_DRAWER_POSITION = new THREE.Vector3(1.3, -0.45, 0);

// Poses for "look here" after each ring.
const LEFT_VIEW = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.28, Math.PI / 2 - 0.45, 0),
);
const FRONT_VIEW = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.25, -0.4, 0),
);
const RIGHT_VIEW = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.28, -Math.PI / 2 + 0.45, 0),
);
const TOP_VIEW = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.8, -0.45, 0),
);

// shortcut: `?lid` unlocks the lid from the start (for testing Acts 2–3).
// Dev server only, so the published game cannot be skipped.
const DEBUG_LID =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("lid");

function createShadowPoolTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const fade = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  fade.addColorStop(0, "rgba(0, 0, 0, 0.62)");
  fade.addColorStop(0.45, "rgba(0, 0, 0, 0.34)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// Saved progress: how many steps of STAGES are done.
const SAVE_KEY = "puzzle-box:stage";

function readStage() {
  try {
    return Number(localStorage.getItem(SAVE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStage(stage: number | null) {
  try {
    if (stage === null) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, String(stage));
  } catch {
    // Private mode: progress lasts for this visit only.
  }
}

type ScreenInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PuzzleBox3DOptions = {
  onFocusChange?: (
    face: FocusTarget | null,
  ) => void;

  onMazeSolved?: () => void;
  onNfcSolved?: () => void;
  onCornerGearSolved?: () => void;
  onTouchKeysSolved?: () => void;
  onFinalSolved?: () => void;

  onCardPickedUp?: () => void;
  onPuckPickedUp?: () => void;
  onTokenPickedUp?: () => void;

  getSelectedInventoryItem?: () =>
    InventoryItemId | null;

  consumeInventoryItem?: (
    item: InventoryItemId,
  ) => boolean;
};

export class PuzzleBox3D {
  private host: HTMLElement;

  private scene = new THREE.Scene();

  private camera = new THREE.PerspectiveCamera(
    36,
    1,
    0.1,
    100,
  );

  private renderer: THREE.WebGLRenderer;

  private boxRoot = new THREE.Group();
  private materials: BoxMaterials;

  private rotationController: BoxRotationController;
  private focusController: BoxFaceFocusController;

  // Act 1: front maze (power) → back matrix (card) → left NFC → right knob
  // → top touch keys.
  private mazePuzzle: BallMazePuzzle;
  private matrixPuzzle: LightsMatrixPuzzle;
  private nfcPuzzle: NfcReaderPuzzle;
  private cornerGearPuzzle: CornerGearPuzzle;
  private touchKeysPuzzle: TouchKeysPuzzle;
  private interiorPuzzle: InteriorPuzzle;


  private focusMeshes =
    new Map<FocusTarget, THREE.Mesh>();

  private lidPivot = new THREE.Group();
  private knobAnchor = new THREE.Group();
  private puckAnchor = new THREE.Group();
  // Progress lights on the base: off until the maze powers the box.
  private statusLeds: THREE.Mesh[] = [];
  private delayedCalls: gsap.core.Tween[] = [];
  private insideLight = new THREE.PointLight(PALETTE.amberLight, 0, 7, 2);
  private insidePickMesh: THREE.Mesh;
  private lid: BoxLid;
  // The face the player should work on next, for the hint button.
  private hintFace: FocusTarget = "front";
  // Steps done, in play order; see STAGES in restoreProgress().
  private stage = 0;
  private disposed = false;

  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private timer = new THREE.Timer();

  // The scene only changes on input, inertia or gsap tweens, so frames
  // are rendered on demand instead of continuously. This keeps phones
  // cool and saves battery while the player is thinking.
  private needsRender = true;
  private lastInputTime = 0;

  private viewportWidth = 1;
  private viewportHeight = 1;

  // Space covered by the HUD on phones; the 3D view is fitted
  // into the area that is left over.
  private hudInsets: ScreenInsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  public readonly dimensions: BoxDimensions = {
    width: 6.4,
    height: 4.2,
    depth: 4.8,
  };

  public readonly faceAnchors =
    createFaceAnchors(
      this.dimensions,
    );

  constructor(
    host: HTMLElement,
    options: PuzzleBox3DOptions = {},
  ) {
    this.host = host;

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference:
          "high-performance",
      });

    // Phone screens are often 3x; rendering at that density is slow
    // and makes the phone hot for little visible gain.
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        IS_TOUCH_DEVICE ? 1.5 : 2,
      ),
    );

    this.renderer.shadowMap.enabled =
      true;

    this.renderer.shadowMap.type =
      THREE.PCFShadowMap;

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    this.renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    this.renderer.toneMappingExposure =
      1.08;

    this.renderer.domElement.style.display =
      "block";

    this.renderer.domElement.style.width =
      "100%";

    this.renderer.domElement.style.height =
      "100%";

    this.host.appendChild(
      this.renderer.domElement,
    );

    this.materials =
      createBoxMaterials();

    this.createScene();
    this.createPuzzleBox();

    this.scene.add(this.boxRoot);

    this.boxRoot.rotation.set(
      -0.28,
      0.52,
      0.04,
    );

    this.rotationController =
      new BoxRotationController(
        this.renderer.domElement,
        this.boxRoot,
      );

    const canvas = this.renderer.domElement;
    const getSelectedItem = () =>
      options.getSelectedInventoryItem?.() ?? null;
    const consumeItem = (item: InventoryItemId) =>
      options.consumeInventoryItem?.(item) ?? false;

    // Ring 1 (front): the ball closes the circuit; the box wakes up.
    this.mazePuzzle = new BallMazePuzzle({
      anchor: this.faceAnchors.front,
      canvas,
      camera: this.camera,
      onPowered: () => {
        this.lightStatus(0);
        this.matrixPuzzle.powerOn();
        this.nfcPuzzle.powerOn(this.matrixPuzzle.pattern());
        options.onMazeSolved?.();
        this.hintFace = "back";
        this.reach(1);
        // The e-ink screen says what the box wants next.
        this.presentLater(LEFT_VIEW, 1.6);
      },
      onCardPickedUp: () => {
        this.hintFace = "left";
        options.onCardPickedUp?.();
        this.reach(3);
        this.presentLater(LEFT_VIEW, 0.5);
      },
    });

    // Ring 2 (back): clearing the matrix makes the dispenser give the card.
    this.matrixPuzzle = new LightsMatrixPuzzle({
      anchor: this.faceAnchors.back,
      canvas,
      camera: this.camera,
      onChange: (lit) => this.nfcPuzzle.setRearPattern(lit),
      onSolved: () => {
        this.lightStatus(1);
        this.mazePuzzle.releaseCard();
        this.nfcPuzzle.cardReleased();
        this.hintFace = "front";
        this.reach(2);
        this.presentLater(FRONT_VIEW, 0.4);
      },
    });

    // Ring 3 (left): the card makes the e-ink screen print the knob sequence.
    this.nfcPuzzle = new NfcReaderPuzzle({
      anchor: this.faceAnchors.left,
      canvas,
      camera: this.camera,
      getSelectedItem,
      consumeItem,
      onTokenRead: () => {
        this.reach(10);
        // Finished: the next visit starts a fresh box.
        writeStage(null);
        // Back to the whole box: the four status lights go blue one by one,
        // the prize rises out of the open box, then the ending card.
        this.delayedCalls.push(
          gsap.delayedCall(1.2, () => this.focusController.exitFocus(FRONT_VIEW)),
          gsap.delayedCall(3.4, () => {
            shimmer();
            this.interiorPuzzle.revealPrize();
          }),
        );
        this.statusLeds.forEach((led, i) => {
          this.delayedCalls.push(
            gsap.delayedCall(2 + 0.35 * i, () => {
              (led.material as THREE.MeshStandardMaterial).emissive.set(PALETTE.tokenBlue);
              setLed(led, 2.6, 0.2);
            }),
          );
        });
        this.delayedCalls.push(gsap.delayedCall(8.5, () => options.onFinalSolved?.()));
      },
      onSolved: () => {
        this.lightStatus(2);
        this.cornerGearPuzzle.freeGear();
        options.onNfcSolved?.();
        this.hintFace = "right";
        this.reach(4);
        // Leave time to read the log first.
        this.presentLater(RIGHT_VIEW, 2.6);
      },
    });

    // Ring 4 (right face): the knob opens the drawer with the puck.
    this.knobAnchor.position.copy(KNOB_POSITION);
    this.puckAnchor.position.copy(PUCK_DRAWER_POSITION);
    this.faceAnchors.right.add(this.knobAnchor, this.puckAnchor);
    this.cornerGearPuzzle = new CornerGearPuzzle({
      anchor: this.knobAnchor,
      medalAnchor: this.puckAnchor,
      canvas,
      camera: this.camera,
      onSolved: () => {
        this.lightStatus(3);
        options.onCornerGearSolved?.();
        this.reach(5);
      },
      onMedalPickedUp: () => {
        options.onPuckPickedUp?.();
        this.hintFace = "top";
        this.reach(6);
        this.presentLater(TOP_VIEW, 0.5);
      },
    });

    // Lid: docking the puck wakes touch keys hidden under the veneer.
    this.touchKeysPuzzle = new TouchKeysPuzzle({
      anchor: this.faceAnchors.top,
      canvas,
      camera: this.camera,
      getSelectedItem,
      consumeItem,
      onSolved: () => {
        // The lock lets go; the lid lifts a crack.
        this.lid.unlock();
        gsap.fromTo(
          this.boxRoot.position,
          { x: 0.06 },
          { x: 0, duration: 0.5, ease: "elastic.out(1.2, 0.3)" },
        );
        this.touchKeysPuzzle.setEnabled(false);
        options.onTouchKeysSolved?.();
        this.reach(7);
      },
    });

    this.interiorPuzzle = new InteriorPuzzle({
      parent: this.boxRoot,
      floorY: FALSE_FLOOR_Y + 0.04,
      lid: this.lidPivot,
      rackAt: new THREE.Vector3(0, -LID_THICKNESS, this.dimensions.depth / 2),
      canvas: this.renderer.domElement,
      camera: this.camera,
      onSolved: () => {
        // Blue light fills the box; the token hovers until it is taken.
        gsap.to(this.insideLight.color, { r: 0.35, g: 0.6, b: 1, duration: 1.5 });
        gsap.to(this.insideLight, { intensity: 26, duration: 1.5 });
        this.reach(8);
      },
      onTokenTaken: () => {
        options.onTokenPickedUp?.();
        this.nfcPuzzle.tokenReleased();
        this.hintFace = "left";
        this.reach(9);
        // Back to the whole box; where the token goes is for the player to find.
        this.delayedCalls.push(gsap.delayedCall(0.8, () => this.focusController.exitFocus()));
      },
    });

    this.lid = new BoxLid({
      pivot: this.lidPivot,
      light: this.insideLight,
      canvas: this.renderer.domElement,
      onOpened: () => {
        // The top face now hangs open behind the box; the opening replaces it.
        this.focusMeshes.delete("top");
        this.boxRoot.add(this.insidePickMesh);
        this.focusMeshes.set("inside", this.insidePickMesh);
        this.hintFace = "inside";
        this.focusController.focus("inside");
      },
    });

    if (DEBUG_LID) this.lid.unlock();

    this.focusController =
      new BoxFaceFocusController({
        canvas:
          this.renderer.domElement,
        camera: this.camera,
        boxRoot: this.boxRoot,
        focusMeshes:
          this.focusMeshes,
        rotationController:
          this.rotationController,

        getCameraZ: (face) =>
          this.getCameraZ(face),
        // The open lid stands up behind the box; lower the box to keep both in frame.
        getBoxOffset: (face) => {
          // The open lid stands up behind the box; lower the box to keep both in frame.
          if (face === "inside") return new THREE.Vector3(0, this.isWideScreen() ? -1.5 : -1.7, 0);
          if (!face && this.lid.isOpen) return new THREE.Vector3(0, -1.2, 0);
          return new THREE.Vector3();
        },

        onFocusChange: (face) => {
          this.mazePuzzle.setEnabled(face === "front");
          this.matrixPuzzle.setEnabled(face === "back");
          this.nfcPuzzle.setEnabled(face === "left");
          this.cornerGearPuzzle.setEnabled(face === "right");

          // Once unlocked, dragging on top lifts the lid instead.
          this.touchKeysPuzzle.setEnabled(face === "top" && !this.lid.isUnlocked);
          this.lid.setEnabled(face === "top");
          this.interiorPuzzle.setEnabled(face === "inside");

          options.onFocusChange?.(
            face,
          );
        },
      });

    this.resizeObserver =
      new ResizeObserver(
        () => this.resize(),
      );

    this.resizeObserver.observe(
      this.host,
    );

    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "wheel",
    ]) {
      this.host.addEventListener(
        type,
        this.handleInput,
        { capture: true, passive: true },
      );
    }

    window.addEventListener(
      "keydown",
      this.handleInput,
    );

    this.timer.connect(document);

    this.resize();
    this.animate();
    void this.restoreProgress(readStage());
  }

  private reach(stage: number) {
    if (stage <= this.stage) return;
    this.stage = stage;
    writeStage(stage);
  }

  // Replays the saved steps through each mechanism's own solve path, sped up,
  // silent and hidden, so the box ends up exactly as the player left it.
  private async restoreProgress(saved: number) {
    if (saved <= 0) return;
    const STAGES = [
      () => this.mazePuzzle.skipToPowered(),
      () => this.matrixPuzzle.skipSolve(),
      () => this.mazePuzzle.skipPickUpCard(),
      () => this.nfcPuzzle.skipReadCard(),
      () => this.cornerGearPuzzle.skipSolve(),
      () => this.cornerGearPuzzle.skipPickUp(),
      () => this.touchKeysPuzzle.skipSolve(),
      () => this.interiorPuzzle.skipSolve(),
      () => this.interiorPuzzle.skipTakeToken(),
      // Never saved (finishing clears the save); lets a test replay the ending.
      () => this.nfcPuzzle.skipReadToken(),
    ];
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

    this.host.style.opacity = "0";
    hush(true);
    gsap.globalTimeline.timeScale(25);
    try {
      for (let i = 0; i < Math.min(saved, STAGES.length); i++) {
        // The lid opens itself after stage 7; the inside needs it open.
        while (i === 7 && !this.lid.isOpen && !this.disposed) await frame();
        STAGES[i]();
        for (let wait = 0; this.stage <= i && wait < 600; wait++) await frame();
        if (this.disposed) return;
        // A step that did not finish: stop here rather than skip ahead.
        if (this.stage <= i) break;
      }
      // Let pending camera moves land before showing the box.
      for (let wait = 0; wait < 30; wait++) await frame();
    } finally {
      if (!this.disposed) {
        gsap.globalTimeline.timeScale(1);
        hush(false);
        this.host.style.transition = "opacity 0.5s";
        this.host.style.opacity = "1";
      }
    }
  }

  private handleInput = () => {
    this.lastInputTime =
      performance.now();
  };

  private hasActiveTweens() {
    // Finished tweens are removed from the global timeline, so any
    // child left means something is (or is about to be) animating.
    return (
      gsap.globalTimeline.getChildren(
        false,
        true,
        true,
      ).length > 0
    );
  }

  private createScene() {
    // Product shot: dark warm grey, one soft key light from above.
    const background = new THREE.Color(0x161517);
    this.scene.background = background;
    this.scene.fog = new THREE.Fog(background, 18, 36);

    // Reflections for the aluminium and glass.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();

    this.camera.position.set(
      0,
      0.35,
      11.8,
    );

    this.camera.lookAt(
      0,
      0,
      0,
    );

    const hemisphere =
      new THREE.HemisphereLight(
        0xe8e4dc,
        0x1a1816,
        0.5,
      );

    this.scene.add(hemisphere);

    const keyLight =
      new THREE.DirectionalLight(
        0xfff2e2,
        3.2,
      );

    keyLight.position.set(
      3,
      10,
      6,
    );

    keyLight.castShadow = true;

    const shadowSize =
      IS_TOUCH_DEVICE ? 1024 : 2048;

    keyLight.shadow.mapSize.set(
      shadowSize,
      shadowSize,
    );

    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;

    this.scene.add(keyLight);

    const fillLight =
      new THREE.DirectionalLight(
        0xb8c4d6,
        0.45,
      );

    fillLight.position.set(
      -6,
      1,
      4,
    );

    this.scene.add(fillLight);

    const rimLight =
      new THREE.PointLight(
        0xffffff,
        10,
        18,
        2,
      );

    rimLight.position.set(
      3,
      -3,
      -5,
    );

    this.scene.add(rimLight);

    const ground =
      new THREE.Mesh(
        // Wide enough that its edge is lost in the fog (no horizon line).
        new THREE.PlaneGeometry(
          120,
          120,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x1c1b1d,
          roughness: 0.95,
          metalness: 0,
        }),
      );

    ground.rotation.x =
      -Math.PI / 2;

    ground.position.y = -5.1;

    this.scene.add(ground);

    // The box hangs well above the table, so its shadow is a soft pool
    // rather than a hard outline (the cast shadows stay on the box itself).
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 15),
      new THREE.MeshBasicMaterial({
        map: createShadowPoolTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-0.4, -5.09, -0.6);
    this.scene.add(pool);
  }

  private createPuzzleBox() {
    const {
      width,
      height,
      depth,
    } = this.dimensions;

    const wallHeight =
      height - WALL - LID_THICKNESS;
    const wallY =
      (WALL - LID_THICKNESS) / 2;

    const addSlab = (
      parent: THREE.Object3D,
      material: THREE.Material,
      size: [number, number, number],
      position: [number, number, number],
    ) => {
      const slab = new THREE.Mesh(
        material === wood
          ? new RoundedBoxGeometry(...size, 2, EDGE_RADIUS)
          : new THREE.BoxGeometry(...size),
        material,
      );
      slab.position.set(...position);
      slab.castShadow = true;
      slab.receiveShadow = true;
      parent.add(slab);
    };

    const wood = this.materials.wood;

    addSlab(this.boxRoot, wood, [width, WALL, depth], [0, -height / 2 + WALL / 2, 0]);

    for (const z of [-1, 1]) {
      addSlab(this.boxRoot, wood, [width, wallHeight, WALL], [0, wallY, z * (depth / 2 - WALL / 2)]);
    }

    for (const x of [-1, 1]) {
      addSlab(this.boxRoot, wood, [WALL, wallHeight, depth - 2 * WALL], [x * (width / 2 - WALL / 2), wallY, 0]);
    }

    addSlab(
      this.boxRoot,
      this.materials.graphite,
      [width - 2 * WALL, 0.08, depth - 2 * WALL],
      [0, FALSE_FLOOR_Y, 0],
    );

    // Lid: hinged on the back-top edge; opening rotates the pivot.
    this.lidPivot.position.set(0, height / 2, -depth / 2);
    this.boxRoot.add(this.lidPivot);

    addSlab(this.lidPivot, wood, [width, LID_THICKNESS, depth], [0, -LID_THICKNESS / 2, depth / 2]);

    // Plaque on the inside of the back wall, above the gear floor. It tips
    // back to face up toward the camera looking down into the box, and
    // the white inlay glows a little so it reads in the dim interior.
    const clueWidth = width * 0.5;
    const clueTilt = 0.55;
    const clueMap = createGearClueTexture();
    const clue = new THREE.Mesh(
      new THREE.PlaneGeometry(clueWidth, clueWidth / 2),
      new THREE.MeshStandardMaterial({
        map: clueMap,
        emissive: 0xffffff,
        emissiveMap: clueMap,
        emissiveIntensity: 0.35,
        roughness: 0.9,
      }),
    );
    clue.rotation.x = -clueTilt;
    clue.position.set(
      0,
      (FALSE_FLOOR_Y + wallY + wallHeight / 2) / 2 + 0.25,
      -depth / 2 + WALL + Math.sin(clueTilt) * (clueWidth / 4) + 0.01,
    );
    this.boxRoot.add(clue);

    this.insideLight.position.set(0, FALSE_FLOOR_Y + 1.2, 0);
    this.boxRoot.add(this.insideLight);

    // Click target for the open box; only registered once the lid is open.
    this.insidePickMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 2 * WALL, depth - 2 * WALL),
      new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.insidePickMesh.rotation.x = -Math.PI / 2;
    this.insidePickMesh.position.y = height / 2;
    this.insidePickMesh.userData.face = "inside";

    for (
      const name
      of BOX_FACE_NAMES
    ) {
      const anchor =
        this.faceAnchors[name];

      this.boxRoot.add(anchor);

      const size =
        this.getFaceSize(name);

      this.createFacePanel(
        anchor,
        size.width,
        size.height,
        name,
      );
    }

    this.createLidSeam();

    // attach() keeps world transforms, so the top face simply rides along
    // with the lid.
    this.lidPivot.attach(this.faceAnchors.top);

    this.createPlinth();

    // Under the plinth now; nothing to look at.
    this.focusMeshes.delete("bottom");
  }

  // Graphite line where the lid meets the body: the one visible joint.
  private createLidSeam() {
    const { width, height, depth } = this.dimensions;
    const y = height / 2 - LID_THICKNESS;
    const t = 0.03;
    const proud = 0.006;
    for (const z of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(width + proud * 2, t, t), this.materials.graphite);
      strip.position.set(0, y, z * (depth / 2 - t / 2 + proud));
      this.boxRoot.add(strip);
    }
    for (const x of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(t, t, depth + proud * 2), this.materials.graphite);
      strip.position.set(x * (width / 2 - t / 2 + proud), y, 0);
      this.boxRoot.add(strip);
    }
  }

  private createPlinth() {
    const { width, height, depth } = this.dimensions;
    const plinthWidth = width - PLINTH_INSET * 2;
    const plinthDepth = depth - PLINTH_INSET * 2;

    const plinth = new THREE.Mesh(
      new RoundedBoxGeometry(plinthWidth, PLINTH_HEIGHT, plinthDepth, 2, EDGE_RADIUS),
      this.materials.aluminum,
    );
    plinth.position.y = -height / 2 - PLINTH_HEIGHT / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.boxRoot.add(plinth);

    // Underneath: a stamped maker's mark for whoever turns the box over.
    const markSize = Math.min(plinthWidth, plinthDepth) * 0.55;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(markSize, markSize),
      new THREE.MeshStandardMaterial({
        map: createMakersMarkTexture(),
        transparent: true,
        metalness: 0.6,
        roughness: 0.55,
      }),
    );
    mark.rotation.x = Math.PI / 2;
    mark.position.y = plinth.position.y - PLINTH_HEIGHT / 2 - 0.003;
    this.boxRoot.add(mark);

    // Four status lights, one per ring, on the front of the base.
    for (let i = 0; i < 4; i++) {
      const led = createLed(new THREE.CircleGeometry(0.075, 24));
      led.position.set(-plinthWidth / 2 + 0.45 + i * 0.28, plinth.position.y, plinthDepth / 2 + 0.002);
      this.boxRoot.add(led);
      this.statusLeds.push(led);
    }
  }

  private lightStatus(index: number) {
    chime();
    setLed(this.statusLeds[index], 2.2, 0.4);
  }

  private presentLater(rotation: THREE.Quaternion, delay: number) {
    this.delayedCalls.push(
      gsap.delayedCall(delay, () => this.focusController.present(rotation)),
    );
  }

  private getFaceSize(
    face: BoxFaceName,
  ) {
    const {
      width,
      height,
      depth,
    } = this.dimensions;

    if (
      face === "front" ||
      face === "back"
    ) {
      return {
        width,
        height,
      };
    }

    if (
      face === "left" ||
      face === "right"
    ) {
      return {
        width: depth,
        height,
      };
    }

    return {
      width,
      height: depth,
    };
  }

  private createFacePanel(
    anchor: THREE.Group,
    width: number,
    height: number,
    face: BoxFaceName,
  ) {
    // Own copy: the focus highlight changes this face only. A hair smaller
    // than the face, so the body wood shows as a fine line round it.
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.12, height - 0.12),
      this.materials.panel.clone(),
    );
    panel.position.z = 0.012;
    panel.receiveShadow = true;
    panel.name = `panel-${face}`;
    panel.userData.face = face;
    anchor.add(panel);
    this.focusMeshes.set(face, panel);
  }

  private resize() {
    const rect =
      this.host.getBoundingClientRect();

    const width =
      Math.max(
        1,
        rect.width,
      );

    const height =
      Math.max(
        1,
        rect.height,
      );

    this.viewportWidth = width;
    this.viewportHeight = height;

    this.renderer.setSize(
      width,
      height,
      false,
    );

    this.camera.aspect =
      width / height;

    this.hudInsets =
      this.measureHudInsets(
        width,
        height,
      );

    const {
      top,
      right,
      bottom,
      left,
    } = this.hudInsets;

    // Shift the center of the view into the free area between
    // the HUD bars (e.g. above the inventory on a phone).
    if (
      top + right + bottom + left >
      0
    ) {
      this.camera.setViewOffset(
        width,
        height,
        (right - left) / 2,
        (bottom - top) / 2,
        width,
        height,
      );
    } else {
      this.camera.clearViewOffset();
    }

    this.camera.updateProjectionMatrix();

    // Undefined during the first resize inside the constructor.
    this.focusController?.refreshCamera();

    // setSize() clears the canvas; draw right away so a resize
    // never shows an empty frame.
    this.renderer.render(
      this.scene,
      this.camera,
    );
  }

  // Only on phone-sized layouts, where the HUD is laid out as bars
  // (see the media queries in global.css). On a desktop the HUD
  // floats over the scene as before.
  private measureHudInsets(
    width: number,
    height: number,
  ): ScreenInsets {
    const insets: ScreenInsets = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };

    const compact =
      (height >= width &&
        width <= 600) ||
      (width > height &&
        height <= 500);

    if (!compact) return insets;

    const hostRect =
      this.host.getBoundingClientRect();

    const gap = 6;

    for (
      const element
      of this.host.querySelectorAll<HTMLElement>(
        "[data-hud]",
      )
    ) {
      const rect =
        element.getBoundingClientRect();

      if (
        rect.width === 0 ||
        rect.height === 0
      ) {
        continue;
      }

      if (
        element.dataset.hud ===
        "top"
      ) {
        insets.top = Math.max(
          insets.top,
          rect.bottom -
            hostRect.top +
            gap,
        );

        continue;
      }

      // Inventory: a bar along the bottom (portrait)
      // or a column on the right (landscape).
      if (
        rect.width >=
        rect.height
      ) {
        insets.bottom = Math.max(
          insets.bottom,
          hostRect.bottom -
            rect.top +
            gap,
        );
      } else {
        insets.right = Math.max(
          insets.right,
          hostRect.right -
            rect.left +
            gap,
        );
      }
    }

    return insets;
  }

  // Distance at which an object of the given size fits into the
  // free (non-HUD) part of the screen.
  // Phone in landscape: short and wide.
  private isWideScreen() {
    return this.viewportHeight < 600 && this.viewportWidth / Math.max(1, this.viewportHeight) > 1.6;
  }

  private getFitDistance(
    objectWidth: number,
    objectHeight: number,
  ) {
    const {
      top,
      right,
      bottom,
      left,
    } = this.hudInsets;

    const freeWidth =
      Math.max(
        1,
        this.viewportWidth -
          left -
          right,
      );

    const freeHeight =
      Math.max(
        1,
        this.viewportHeight -
          top -
          bottom,
      );

    const tanHalfFov =
      Math.tan(
        THREE.MathUtils.degToRad(
          this.camera.fov / 2,
        ),
      );

    return (
      (this.viewportHeight /
        (2 * tanHalfFov)) *
      Math.max(
        objectHeight /
          freeHeight,
        objectWidth /
          freeWidth,
      )
    );
  }

  private getCameraZ(
    face: FocusTarget | null,
  ) {
    if (!face) {
      return Math.max(
        OVERVIEW_CAMERA_Z,
        this.getFitDistance(
          OVERVIEW_FIT_WIDTH,
          // Undefined during the first resize inside the constructor.
          this.lid?.isOpen
            ? OVERVIEW_FIT_HEIGHT + 4
            : OVERVIEW_FIT_HEIGHT,
        ),
      );
    }

    if (face === "inside") {
      // Open box seen from 60° above, with the lid standing up behind it.
      // On short wide screens (phone landscape) the top of the lid, above
      // the rack, is let go so the gears stay big enough to tap.
      return Math.max(
        FOCUS_CAMERA_Z,
        this.dimensions.height / 2 +
          this.getFitDistance(
            this.dimensions.width * 1.12,
            this.isWideScreen() ? 7 : 11.5,
          ),
      );
    }

    const size =
      this.getFaceSize(face);

    // The focused face is turned toward the camera, so its plane
    // sits this far in front of the box center.
    const {
      width,
      height,
      depth,
    } = this.dimensions;

    const faceOffset =
      face === "front" ||
      face === "back"
        ? depth / 2
        : face === "left" ||
            face === "right"
          ? width / 2
          : height / 2;

    return Math.max(
      FOCUS_CAMERA_Z,
      faceOffset +
        this.getFitDistance(
          size.width *
            FOCUS_FIT_MARGIN,
          size.height *
            FOCUS_FIT_MARGIN,
        ),
    );
  }

  private animate = (
    timestamp?: number,
  ) => {
    this.animationFrame =
      requestAnimationFrame(
        this.animate,
      );

    this.timer.update(timestamp);

    // Before the idle check: the ball may need to start rolling.
    this.mazePuzzle.update();

    const delta =
      Math.min(
        this.timer.getDelta(),
        0.05,
      );

    const rotated =
      this.rotationController.update(
        delta,
      );

    if (
      !rotated &&
      !this.needsRender &&
      performance.now() -
        this.lastInputTime >
        INPUT_RENDER_MS &&
      !this.hasActiveTweens()
    ) {
      return;
    }

    this.needsRender = false;

    this.renderer.render(
      this.scene,
      this.camera,
    );
  };

  public getRoot() {
    return this.boxRoot;
  }

  public getFaceAnchor(
    face: BoxFaceName,
  ) {
    return this.faceAnchors[
      face
    ];
  }

  public focusFace(
    face: BoxFaceName,
  ) {
    this.focusController.focus(
      face,
    );
  }

  // Optional hint: look straight at the face that matters now.
  public hint() {
    this.focusController.focus(this.hintFace);
  }

  public exitFocus() {
    this.focusController.exitFocus();
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(
      this.animationFrame,
    );

    this.resizeObserver.disconnect();

    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "wheel",
    ]) {
      this.host.removeEventListener(
        type,
        this.handleInput,
        { capture: true },
      );
    }

    window.removeEventListener(
      "keydown",
      this.handleInput,
    );

    this.timer.dispose();

    this.mazePuzzle.dispose();
    this.matrixPuzzle.dispose();
    this.nfcPuzzle.dispose();
    this.cornerGearPuzzle.dispose();
    this.touchKeysPuzzle.dispose();
    this.interiorPuzzle.dispose();
    this.lid.dispose();
    for (const call of this.delayedCalls) call.kill();
    for (const led of this.statusLeds) gsap.killTweensOf(led.material);

    this.focusController.dispose();
    this.rotationController.dispose();

    this.scene.traverse(
      (object) => {
        if (
          !(
            object
            instanceof
            THREE.Mesh
          )
        ) {
          return;
        }

        object.geometry.dispose();
      },
    );

    const materialSet =
      new Set<
        THREE.Material
      >();

    for (
      const material
      of Object.values(
        this.materials,
      )
    ) {
      materialSet.add(
        material,
      );
    }

    this.scene.traverse(
      (object) => {
        if (
          !(
            object
            instanceof
            THREE.Mesh
          )
        ) {
          return;
        }

        const materials =
          Array.isArray(
            object.material,
          )
            ? object.material
            : [object.material];

        for (
          const material
          of materials
        ) {
          materialSet.add(
            material,
          );
        }
      },
    );

    for (
      const material
      of materialSet
    ) {
      // Canvas textures (labels, symbols) are not freed by
      // material.dispose(), so release them explicitly.
      for (const value of Object.values(
        material,
      )) {
        if (
          value instanceof
          THREE.Texture
        ) {
          value.dispose();
        }
      }

      material.dispose();
    }

    this.scene.environment?.dispose();
    this.renderer.dispose();

    if (
      this.renderer.domElement
        .parentElement ===
      this.host
    ) {
      this.host.removeChild(
        this.renderer.domElement,
      );
    }
  }
}

// Four rings, then the key: the whole box in one stamp.
function createMakersMarkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  ctx.strokeStyle = ctx.fillStyle = "rgba(28, 29, 32, 0.8)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.stroke();
  drawPips(ctx, 128, 72, 4);
  drawToken(ctx, 128, 148, 44);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
