import * as THREE from "three";

export const FINAL_SYMBOL_SEQUENCE = [
  1, // ○
  0, // △
  3, // ◇
  2, // □
] as const;

export type SealSymbol =
  | "triangle"
  | "circle"
  | "square"
  | "diamond";

export function createSymbolMesh(
  type: SealSymbol,
  size: number,
  color: number,
) {
  const material =
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    });

  if (type === "circle") {
    return new THREE.Mesh(
      new THREE.RingGeometry(
        size * 0.62,
        size,
        28,
      ),
      material,
    );
  }

  if (type === "triangle") {
    const shape =
      new THREE.Shape();

    shape.moveTo(
      0,
      size,
    );

    shape.lineTo(
      -size * 0.86,
      -size * 0.70,
    );

    shape.lineTo(
      size * 0.86,
      -size * 0.70,
    );

    shape.closePath();

    const hole =
      new THREE.Path();

    hole.moveTo(
      0,
      size * 0.46,
    );

    hole.lineTo(
      -size * 0.40,
      -size * 0.32,
    );

    hole.lineTo(
      size * 0.40,
      -size * 0.32,
    );

    hole.closePath();

    shape.holes.push(
      hole,
    );

    return new THREE.Mesh(
      new THREE.ShapeGeometry(
        shape,
      ),
      material,
    );
  }

  const mesh =
    new THREE.Mesh(
      new THREE.RingGeometry(
        size * 0.62,
        size,
        4,
      ),
      material,
    );

  if (type === "square") {
    mesh.rotation.z =
      Math.PI / 4;
  }

  return mesh;
}

// Where the key tab sits, counter-clockwise from the top.
export const PUCK_TAB_ANGLE = Math.PI / 4;

export function createSealMedalGroup(
  scale = 1,
) {
  const group =
    new THREE.Group();

  group.scale.setScalar(scale);

  const bronze =
    new THREE.MeshStandardMaterial({
      color: 0xaeb3b9,
      roughness: 0.3,
      metalness: 1,
    });

  const darkBronze =
    new THREE.MeshStandardMaterial({
      color: 0x2c2e31,
      roughness: 0.5,
      metalness: 0.3,
    });

  const cream = 0x1c1d20; // engraved, dark on the steel face

  const body =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.39,
        0.39,
        0.085,
        48,
      ),
      bronze,
    );

  body.rotation.x =
    Math.PI / 2;

  group.add(body);

  const outerRing =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.31,
        0.035,
        10,
        40,
      ),
      darkBronze,
    );

  outerRing.position.z =
    0.055;

  group.add(outerRing);

  // One key tab on the rim, between □ and ○: docked, it must point at the
  // lid's mark. Reading clockwise from it gives the key order ○ △ ◇ □.
  const tab =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.13,
        0.18,
        0.07,
      ),
      bronze,
    );

  tab.position.set(
    -Math.sin(PUCK_TAB_ANGLE) * 0.39,
    Math.cos(PUCK_TAB_ANGLE) * 0.39,
    0.04,
  );

  tab.rotation.z = PUCK_TAB_ANGLE;

  group.add(tab);

  const centerRing =
    new THREE.Mesh(
      new THREE.RingGeometry(
        0.075,
        0.11,
        4,
      ),
      new THREE.MeshBasicMaterial({
        color: cream,
        side: THREE.DoubleSide,
      }),
    );

  centerRing.position.z =
    0.07;

  group.add(centerRing);

  const centerDot =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        0.028,
        24,
      ),
      new THREE.MeshBasicMaterial({
        color: 0x1a1b1d,
      }),
    );

  centerDot.position.z =
    0.075;

  group.add(centerDot);

  // Symbols clockwise from the tab: ○ △ ◇ □.
  const clues = [
    {
      type: "circle" as const,
      x: 0,
      y: 0.225,
    },
    {
      type: "triangle" as const,
      x: 0.225,
      y: 0,
    },
    {
      type: "diamond" as const,
      x: 0,
      y: -0.225,
    },
    {
      type: "square" as const,
      x: -0.225,
      y: 0,
    },
  ];

  for (const clue of clues) {
    const symbol =
      createSymbolMesh(
        clue.type,
        0.07,
        cream,
      );

    symbol.position.set(
      clue.x,
      clue.y,
      0.078,
    );
    // Upright once docked with the tab on the mark (the puck then sits
    // turned by -PUCK_TAB_ANGLE); otherwise □ and ◇ would swap looks.
    symbol.rotation.z += PUCK_TAB_ANGLE;

    group.add(symbol);
  }

  // Engraved arrow: starts at the tab and runs clockwise through the
  // symbols, so the order reads ○ → △ → ◇ → □ in any language.
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: cream,
    side: THREE.DoubleSide,
  });
  const arrowRadius = 0.135;
  // Three.js angles run counter-clockwise from +x; the tab is at 3π/4.
  const tabTheta = Math.PI / 2 + PUCK_TAB_ANGLE;
  const startTheta = tabTheta - 0.35;
  const endTheta = tabTheta - Math.PI * 2 + 0.5;

  const arc = new THREE.Mesh(
    new THREE.RingGeometry(
      arrowRadius - 0.012,
      arrowRadius + 0.012,
      64,
      1,
      endTheta,
      startTheta - endTheta,
    ),
    arrowMaterial,
  );
  arc.position.z = 0.078;
  group.add(arc);

  const tail = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), arrowMaterial);
  tail.position.set(
    Math.cos(startTheta) * arrowRadius,
    Math.sin(startTheta) * arrowRadius,
    0.079,
  );
  group.add(tail);

  // Head at the clockwise end, pointing along the way round.
  const head = new THREE.Shape();
  head.moveTo(0.06, 0);
  head.lineTo(-0.015, 0.042);
  head.lineTo(-0.015, -0.042);
  head.closePath();
  const headMesh = new THREE.Mesh(new THREE.ShapeGeometry(head), arrowMaterial);
  headMesh.position.set(
    Math.cos(endTheta) * arrowRadius,
    Math.sin(endTheta) * arrowRadius,
    0.079,
  );
  // Clockwise tangent at angle θ points along θ − π/2.
  headMesh.rotation.z = endTheta - Math.PI / 2;
  group.add(headMesh);

  return group;
}
