// Pictograms for the e-ink screen. The game uses no words, so every message
// on the box is drawn. All functions draw with the current stroke/fill style.

type Ctx = CanvasRenderingContext2D;

export function drawPower(ctx: Ctx, x: number, y: number, r: number) {
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + Math.PI * 2);
  ctx.moveTo(x, y - r * 1.15);
  ctx.lineTo(x, y - r * 0.2);
  ctx.stroke();
}

// 3×3 grid: lit cells filled, dark ones outlined.
export function drawGrid(ctx: Ctx, x: number, y: number, cell: number, lit: boolean[]) {
  const gap = cell * 0.22;
  ctx.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    const cx = x + (i % 3) * (cell + gap);
    const cy = y + Math.floor(i / 3) * (cell + gap);
    if (lit[i]) ctx.fillRect(cx, cy, cell, cell);
    else ctx.strokeRect(cx + 2, cy + 2, cell - 4, cell - 4);
  }
  return 3 * cell + 2 * gap;
}

export function drawArrow(ctx: Ctx, x1: number, y: number, x2: number) {
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.moveTo(x2 - 16, y - 16);
  ctx.lineTo(x2, y);
  ctx.lineTo(x2 - 16, y + 16);
  ctx.stroke();
}

function drawWaves(ctx: Ctx, x: number, y: number, r: number) {
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y, r * (0.4 + i * 0.3), -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
  }
}

// The access card as it looks: a rounded card with contactless waves.
export function drawCard(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h * 0.12);
  ctx.stroke();
  ctx.lineWidth = 4;
  drawWaves(ctx, x + w * 0.25, y + h / 2, h * 0.45);
}

export function drawLock(ctx: Ctx, x: number, y: number, s: number, open: boolean) {
  ctx.fillRect(x - s / 2, y, s, s * 0.8);
  ctx.lineWidth = s * 0.16;
  // An open shackle is lifted, with only its left leg still in the body.
  const lift = open ? s * 0.4 : 0;
  ctx.beginPath();
  ctx.arc(x, y - lift, s * 0.3, Math.PI, Math.PI * 2);
  if (open) {
    ctx.moveTo(x - s * 0.3, y - lift);
    ctx.lineTo(x - s * 0.3, y);
  } else {
    ctx.lineTo(x + s * 0.3, y);
  }
  ctx.stroke();
}

// The NFC pad on this panel: a ring with waves inside.
export function drawPad(ctx: Ctx, x: number, y: number, r: number) {
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  drawWaves(ctx, x - r * 0.35, y, r * 0.9);
}

// Drawn like the knob: eight ticks and a pointer. `angle` is canvas
// radians (0 = right, π/2 = down).
export function drawDial(ctx: Ctx, x: number, y: number, r: number, angle: number) {
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    ctx.stroke();
  }
  // Pointer with an arrowhead, like the knob's.
  const tipX = x + Math.cos(angle) * r * 0.66;
  const tipY = y + Math.sin(angle) * r * 0.66;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * r * 0.4, y + Math.sin(angle) * r * 0.4);
  ctx.stroke();
  const side = angle + Math.PI / 2;
  const back = r * 0.32;
  const half = r * 0.17;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - Math.cos(angle) * back + Math.cos(side) * half,
    tipY - Math.sin(angle) * back + Math.sin(side) * half,
  );
  ctx.lineTo(
    tipX - Math.cos(angle) * back - Math.cos(side) * half,
    tipY - Math.sin(angle) * back - Math.sin(side) * half,
  );
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// Order marks: n dots in a row.
export function drawPips(ctx: Ctx, x: number, y: number, n: number) {
  const gap = 18;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (n - 1) / 2) * gap, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The key token from the inner case: a hexagon with a ring inside.
export function drawToken(ctx: Ctx, x: number, y: number, r: number) {
  ctx.lineWidth = r * 0.1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}
