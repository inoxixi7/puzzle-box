import { expect, test, type Page } from "@playwright/test";

// Saved progress is replayed through each mechanism's own solve path, so
// restoring a stage exercises the whole chain of rings up to it. Pointer
// play itself (dragging, tapping in 3D) is not covered here.
const SAVE_KEY = "puzzle-box:stage";

async function loadAtStage(page: Page, stage: number) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, String(stage)],
  );
  await page.goto("/");
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test("fresh box: HUD works, hint focuses the first face", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ヒント" }).click();
  await expect(page.getByRole("button", { name: "観察に戻る" })).toBeVisible();
  await page.getByRole("button", { name: "観察に戻る" }).click();
  await page.getByRole("button", { name: "消音" }).click();
  await expect(page.getByRole("button", { name: "音を出す" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("restored mid-game: card used, puck in hand", async ({ page }) => {
  const errors = trackErrors(page);
  await loadAtStage(page, 6);
  await expect(page.getByRole("button", { name: /マグネット|パック/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /カード/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("restored to the token: everything before it is solved", async ({ page }) => {
  await loadAtStage(page, 9);
  await expect(page.getByRole("button", { name: /キートークン/ })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe("9");
});

test("whole game: the ending appears and the save is cleared", async ({ page }) => {
  const errors = trackErrors(page);
  await loadAtStage(page, 10);
  await expect(page.getByRole("button", { name: "もう一度遊ぶ" })).toBeVisible({ timeout: 40_000 });
  // addInitScript would set it again on reload; read it in place.
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  expect(errors).toEqual([]);
});
