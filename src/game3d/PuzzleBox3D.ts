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

import { BoxRotationController } from "./BoxRotationController";
import { BoxFaceFocusController } from "./BoxFaceFocusController";
import { BoxLid } from "./BoxLid";
import { FrontPuzzleOne } from "./puzzles/FrontPuzzleOne";
import { LeftPuzzleFour } from "./puzzles/LeftPuzzleFour";
import { TopPuzzleTwo } from "./puzzles/TopPuzzleTwo";
import { BackPuzzleThree } from "./puzzles/BackPuzzleThree";
import { RightPuzzleFive } from "./puzzles/RightPuzzleFive";
import { BottomFinalPuzzle } from "./puzzles/BottomFinalPuzzle";
import type { InventoryItemId } from "./inventory/items";

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
const OVERVIEW_FIT_WIDTH = 8.4;
const OVERVIEW_FIT_HEIGHT = 7.0;

// Extra room around a focused face.
const FOCUS_FIT_MARGIN = 1.06;

// How long to keep rendering after the last pointer / key input.
// Puzzle handlers update the scene synchronously, so this only needs
// to cover a few frames.
const INPUT_RENDER_MS = 250;

// Shell thickness of the now hollow box.
const WALL = 0.35;
const LID_THICKNESS = 0.3;
// False floor inside, above the front drawer.
const FALSE_FLOOR_Y = -0.55;

// shortcut: `?lid` unlocks the lid from the start, until the top-face lock
// (redesign phase 2) unlocks it for real.
const DEBUG_LID =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("lid");

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

  onPuzzleOneSolved?: () => void;
  onPuzzleTwoSolved?: () => void;
  onPuzzleThreeSolved?: () => void;
  onPuzzleFourSolved?: () => void;
  onPuzzleFiveSolved?: () => void;
  onFinalSolved?: () => void;

  onSheetPickedUp?: () => void;
  onGearPickedUp?: () => void;
  onKeyPickedUp?: () => void;
  onMedalPickedUp?: () => void;

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

  private puzzleOne: FrontPuzzleOne;
  private puzzleTwo: TopPuzzleTwo;
  private puzzleThree: BackPuzzleThree;
  private puzzleFour: LeftPuzzleFour;
  private puzzleFive: RightPuzzleFive;
  private finalPuzzle: BottomFinalPuzzle;


  private focusMeshes =
    new Map<FocusTarget, THREE.Mesh>();

  private lidPivot = new THREE.Group();
  private lidTrims: THREE.Mesh[] = [];
  private insideLight = new THREE.PointLight(0xffc98a, 0, 7, 2);
  private insidePickMesh: THREE.Mesh;
  private lid: BoxLid;

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

    this.puzzleOne =
      new FrontPuzzleOne({
        anchor:
          this.faceAnchors.front,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        onSolved:
          options.onPuzzleOneSolved,

        onSheetPickedUp: () => {
          options.onSheetPickedUp?.();
        },
      });

    this.puzzleTwo =
      new TopPuzzleTwo({
        anchor:
          this.faceAnchors.top,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        onSolved:
          options.onPuzzleTwoSolved,

        onGearPickedUp: () => {
          options.onGearPickedUp?.();
        },
      });

    this.puzzleThree =
      new BackPuzzleThree({
        anchor:
          this.faceAnchors.back,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        onSolved:
          options.onPuzzleThreeSolved,

        onKeyPickedUp: () => {
          options.onKeyPickedUp?.();
        },
      });

    this.puzzleFour =
      new LeftPuzzleFour({
        anchor:
          this.faceAnchors.left,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        getSelectedItem: () =>
          options.getSelectedInventoryItem?.() ??
          null,

        consumeItem: (
          item,
        ) =>
          options.consumeInventoryItem?.(
            item,
          ) ??
          false,

        onSolved:
          options.onPuzzleFourSolved,
      });

    this.puzzleFive =
      new RightPuzzleFive({
        anchor:
          this.faceAnchors.right,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        getSelectedItem: () =>
          options.getSelectedInventoryItem?.() ??
          null,

        consumeItem: (
          item,
        ) =>
          options.consumeInventoryItem?.(
            item,
          ) ??
          false,

        onSolved:
          options.onPuzzleFiveSolved,

        onMedalPickedUp: () => {
          options.onMedalPickedUp?.();
        },
      });

    this.finalPuzzle =
      new BottomFinalPuzzle({
        anchor:
          this.faceAnchors.bottom,
        canvas:
          this.renderer.domElement,
        camera: this.camera,

        getSelectedItem: () =>
          options.getSelectedInventoryItem?.() ??
          null,

        consumeItem: (
          item,
        ) =>
          options.consumeInventoryItem?.(
            item,
          ) ??
          false,

        onSolved:
          options.onFinalSolved,
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
        getBoxY: (face) =>
          face === "inside"
            ? -1.7
            : !face && this.lid.isOpen
              ? -1.2
              : 0,

        onFocusChange: (face) => {
          this.puzzleOne.setEnabled(
            face === "front",
          );

          // While the lid can be lifted, dragging on top moves the lid.
          this.puzzleTwo.setEnabled(
            face === "top" &&
              !this.lid.isUnlocked,
          );
          this.lid.setEnabled(
            face === "top",
          );

          this.puzzleThree.setEnabled(
            face === "back",
          );

          this.puzzleFour.setEnabled(
            face === "left",
          );

          this.puzzleFive.setEnabled(
            face === "right",
          );

          this.finalPuzzle.setEnabled(
            face === "bottom",
          );

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
    this.scene.background =
      new THREE.Color(0x0b0d10);

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
        0xc9d7e7,
        0x291a12,
        1.25,
      );

    this.scene.add(hemisphere);

    const keyLight =
      new THREE.DirectionalLight(
        0xffe0b8,
        3.2,
      );

    keyLight.position.set(
      5.5,
      7,
      8,
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
        0x89a6c7,
        1.15,
      );

    fillLight.position.set(
      -6,
      1,
      4,
    );

    this.scene.add(fillLight);

    const rimLight =
      new THREE.PointLight(
        0xd7a76b,
        18,
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
        new THREE.PlaneGeometry(
          30,
          30,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x111317,
          roughness: 0.96,
          metalness: 0,
        }),
      );

    ground.rotation.x =
      -Math.PI / 2;

    ground.position.y = -5.1;
    ground.receiveShadow = true;

    this.scene.add(ground);
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
        new THREE.BoxGeometry(...size),
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
      this.materials.woodDark,
      [width - 2 * WALL, 0.08, depth - 2 * WALL],
      [0, FALSE_FLOOR_Y, 0],
    );

    // Lid: hinged on the back-top edge; opening rotates the pivot.
    this.lidPivot.position.set(0, height / 2, -depth / 2);
    this.boxRoot.add(this.lidPivot);

    addSlab(this.lidPivot, wood, [width, LID_THICKNESS, depth], [0, -LID_THICKNESS / 2, depth / 2]);

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

    this.createBrassEdgeTrim();

    // attach() keeps world transforms, so the top face and its trims
    // simply ride along with the lid.
    this.lidPivot.attach(this.faceAnchors.top);
    for (const trim of this.lidTrims) {
      this.lidPivot.attach(trim);
    }
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
    const panelWidth =
      width - 0.32;

    const panelHeight =
      height - 0.32;

    const panelMaterial =
      this.materials.woodInset.clone();

    panelMaterial.emissive.set(
      0x000000,
    );

    panelMaterial.emissiveIntensity =
      0;

    const panel =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          panelWidth,
          panelHeight,
        ),
        panelMaterial,
      );

    panel.position.z = 0.018;
    panel.receiveShadow = true;

    panel.name =
      `panel-${face}`;

    panel.userData.face =
      face;

    anchor.add(panel);

    this.focusMeshes.set(
      face,
      panel,
    );

    const railThickness =
      0.085;

    const railDepth =
      0.07;

    const topRail =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          panelWidth,
          railThickness,
          railDepth,
        ),
        this.materials.brassDark,
      );

    topRail.position.set(
      0,
      panelHeight / 2,
      0.07,
    );

    const bottomRail =
      topRail.clone();

    bottomRail.position.y =
      -panelHeight / 2;

    const leftRail =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          railThickness,
          panelHeight,
          railDepth,
        ),
        this.materials.brassDark,
      );

    leftRail.position.set(
      -panelWidth / 2,
      0,
      0.07,
    );

    const rightRail =
      leftRail.clone();

    rightRail.position.x =
      panelWidth / 2;

    for (const rail of [
      topRail,
      bottomRail,
      leftRail,
      rightRail,
    ]) {
      rail.castShadow = true;
      rail.receiveShadow = true;
      anchor.add(rail);
    }

    const screwGeometry =
      new THREE.CylinderGeometry(
        0.055,
        0.055,
        0.035,
        16,
      );

    const screwPositions = [
      [
        -panelWidth / 2 + 0.16,
        panelHeight / 2 - 0.16,
      ],
      [
        panelWidth / 2 - 0.16,
        panelHeight / 2 - 0.16,
      ],
      [
        -panelWidth / 2 + 0.16,
        -panelHeight / 2 + 0.16,
      ],
      [
        panelWidth / 2 - 0.16,
        -panelHeight / 2 + 0.16,
      ],
    ];

    for (
      const [x, y]
      of screwPositions
    ) {
      const screw =
        new THREE.Mesh(
          screwGeometry,
          this.materials.brass,
        );

      screw.rotation.x =
        Math.PI / 2;

      screw.position.set(
        x,
        y,
        0.105,
      );

      screw.castShadow = true;

      anchor.add(screw);
    }
  }

  private createBrassEdgeTrim() {
    const {
      width,
      height,
      depth,
    } = this.dimensions;

    const t = 0.075;

    const addTrim = (
      geometry: THREE.BoxGeometry,
      x: number,
      y: number,
      z: number,
    ) => {
      const trim =
        new THREE.Mesh(
          geometry,
          this.materials.brassDark,
        );

      trim.position.set(
        x,
        y,
        z,
      );

      trim.castShadow = true;

      this.boxRoot.add(trim);

      // Horizontal trims along the top edges belong to the lid.
      if (
        y === height / 2 &&
        geometry.parameters.height === t
      ) {
        this.lidTrims.push(trim);
      }
    };

    for (
      const y
      of [
        -height / 2,
        height / 2,
      ]
    ) {
      for (
        const z
        of [
          -depth / 2,
          depth / 2,
        ]
      ) {
        addTrim(
          new THREE.BoxGeometry(
            width + t,
            t,
            t,
          ),
          0,
          y,
          z,
        );
      }
    }

    for (
      const x
      of [
        -width / 2,
        width / 2,
      ]
    ) {
      for (
        const z
        of [
          -depth / 2,
          depth / 2,
        ]
      ) {
        addTrim(
          new THREE.BoxGeometry(
            t,
            height + t,
            t,
          ),
          x,
          0,
          z,
        );
      }
    }

    for (
      const x
      of [
        -width / 2,
        width / 2,
      ]
    ) {
      for (
        const y
        of [
          -height / 2,
          height / 2,
        ]
      ) {
        addTrim(
          new THREE.BoxGeometry(
            t,
            t,
            depth + t,
          ),
          x,
          y,
          0,
        );
      }
    }
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
      return Math.max(
        FOCUS_CAMERA_Z,
        this.dimensions.height / 2 +
          this.getFitDistance(
            this.dimensions.width * 1.12,
            11.5,
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

  public exitFocus() {
    this.focusController.exitFocus();
  }

  public setSelectedInventoryItem(
    item:
      InventoryItemId | null,
  ) {
    this.puzzleFour.setSelectedItem(
      item,
    );

    this.puzzleFive.setSelectedItem(
      item,
    );

    this.finalPuzzle.setSelectedItem(
      item,
    );

    this.needsRender = true;
  }

  public dispose() {
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

    this.puzzleOne.dispose();
    this.puzzleTwo.dispose();
    this.puzzleThree.dispose();
    this.puzzleFour.dispose();
    this.puzzleFive.dispose();
    this.finalPuzzle.dispose();
    this.lid.dispose();

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
