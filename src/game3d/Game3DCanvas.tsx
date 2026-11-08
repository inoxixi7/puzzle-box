import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  PuzzleBox3D,
} from "./PuzzleBox3D";

import type {
  FocusTarget,
} from "./BoxFace";

import {
  InventoryBar,
} from "./inventory/InventoryBar";

import {
  useGameStore,
} from "../store/useGameStore";

const FACE_NAMES: Record<
  FocusTarget,
  string
> = {
  inside: "箱の中",
  front: "正面",
  right: "右側",
  back: "背面",
  left: "左側",
  top: "上面",
  bottom: "底面",
};

// Phones and tablets: say "タップ" instead of "クリック".
const IS_TOUCH_DEVICE =
  typeof window !== "undefined" &&
  window.matchMedia(
    "(pointer: coarse)",
  ).matches;

export function Game3DCanvas() {
  const hostRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const gameRef =
    useRef<
      PuzzleBox3D | null
    >(null);

  const [
    focusedFace,
    setFocusedFace,
  ] = useState<
    FocusTarget | null
  >(null);

  const selectedItem =
    useGameStore(
      (state) =>
        state.selectedItem,
    );

  const addItem =
    useGameStore(
      (state) =>
        state.addItem,
    );

  const markPuzzleSolved =
    useGameStore(
      (state) =>
        state.markPuzzleSolved,
    );

  const frontSolved =
    useGameStore(
      (state) =>
        state.puzzles.front,
    );

  const finalSolved =
    useGameStore(
      (state) =>
        state.puzzles.final,
    );

  useEffect(() => {
    const host =
      hostRef.current;

    if (!host) return;

    const game =
      new PuzzleBox3D(
        host,
        {
          onFocusChange: (
            face,
          ) => {
            setFocusedFace(
              face,
            );
          },

          onPuzzleOneSolved: () => {
            markPuzzleSolved(
              "front",
            );
          },

          onPuzzleTwoSolved: () => {
            markPuzzleSolved(
              "top",
            );
          },

          onPuzzleThreeSolved: () => {
            markPuzzleSolved(
              "back",
            );
          },

          onPuzzleFourSolved: () => {
            markPuzzleSolved(
              "left",
            );
          },

          onPuzzleFiveSolved: () => {
            markPuzzleSolved(
              "right",
            );
          },

          onFinalSolved: () => {
            markPuzzleSolved(
              "final",
            );
          },

          onSheetPickedUp: () => {
            addItem(
              "overlay-sheet",
            );
          },

          onGearPickedUp: () => {
            addItem(
              "small-gear",
            );
          },

          onKeyPickedUp: () => {
            addItem(
              "brass-key",
            );
          },

          onMedalPickedUp: () => {
            addItem(
              "seal-medal",
            );
          },

          getSelectedInventoryItem:
            () =>
              useGameStore.getState()
                .selectedItem,

          consumeInventoryItem: (
            item,
          ) =>
            useGameStore
              .getState()
              .removeItem(
                item,
              ),
        },
      );

    gameRef.current = game;

    game.setSelectedInventoryItem(
      useGameStore.getState()
        .selectedItem,
    );

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [
    addItem,
    markPuzzleSolved,
  ]);

  useEffect(() => {
    gameRef.current
      ?.setSelectedInventoryItem(
        selectedItem,
      );
  }, [selectedItem]);

  return (
    <div
      ref={hostRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background:
          "#0b0d10",
        userSelect: "none",
        // Stop pinch-zoom / page scrolling from stealing touch drags.
        touchAction: "none",
      }}
    >
      {!focusedFace && (
        <div
          className="hud-top-label"
          data-hud="top"
          style={{
            color:
              "rgba(232, 220, 198, 0.82)",
            letterSpacing:
              "0.04em",
            background:
              "rgba(14, 12, 10, 0.48)",
            border:
              "1px solid rgba(183, 145, 88, 0.28)",
          }}
        >
          {IS_TOUCH_DEVICE
            ? "ドラッグして箱を回す・面をタップして調べる"
            : "ドラッグして箱を回す・面をクリックして調べる"}

          <span className="hud-sub-hint">
            横向きにすると遊びやすくなります
          </span>
        </div>
      )}

      {focusedFace && (
        <>
          <div
            className="hud-top-label has-button"
            data-hud="top"
            style={{
              color:
                "rgba(232, 220, 198, 0.88)",
              background:
                "rgba(14, 12, 10, 0.58)",
              border:
                "1px solid rgba(183, 145, 88, 0.32)",
            }}
          >
            {
              FACE_NAMES[
                focusedFace
              ]
            }
            を調べています
            {focusedFace ===
              "front" &&
              !frontSolved &&
              "・数字盤は上下にドラッグ"}
          </div>

          <button
            type="button"
            onClick={() => {
              gameRef.current
                ?.exitFocus();
            }}
            className="hud-back-button"
            data-hud="top"
            style={{
              border:
                "1px solid rgba(183, 145, 88, 0.48)",
              background:
                "rgba(24, 18, 13, 0.84)",
              color:
                "#e7d3ad",
            }}
          >
            観察に戻る
          </button>
        </>
      )}

      {finalSolved && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background:
              "rgba(5, 8, 14, 0.68)",
            backdropFilter:
              "blur(8px)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              width:
                "min(560px, calc(100vw - 40px))",
              padding:
                "38px 34px 32px",
              borderRadius: 18,
              textAlign: "center",
              color: "#eef5ff",
              background:
                "linear-gradient(180deg, rgba(18, 29, 48, 0.96), rgba(9, 15, 27, 0.96))",
              border:
                "1px solid rgba(89, 151, 238, 0.58)",
              boxShadow:
                "0 24px 70px rgba(0, 0, 0, 0.52), 0 0 48px rgba(45, 117, 224, 0.22)",
            }}
          >
            <div
              style={{
                marginBottom: 14,
                fontSize:
                  "clamp(30px, 5vw, 42px)",
                fontWeight: 700,
                letterSpacing:
                  "0.08em",
                color: "#ffffff",
                textShadow:
                  "0 0 22px rgba(85, 154, 255, 0.34)",
              }}
            >
              おめでとうございます！
            </div>

            <div
              style={{
                margin:
                  "0 auto 28px",
                maxWidth: 430,
                fontSize:
                  "clamp(16px, 2.5vw, 20px)",
                lineHeight: 1.8,
                letterSpacing:
                  "0.04em",
                color:
                  "rgba(224, 236, 255, 0.92)",
              }}
            >
              宝箱の封印を解き、
              <br />
              青い宝石を手に入れました。
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              style={{
                minWidth: 180,
                minHeight: 52,
                padding:
                  "0 24px",
                borderRadius: 12,
                border:
                  "1px solid rgba(115, 170, 244, 0.72)",
                background:
                  "rgba(41, 91, 161, 0.72)",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing:
                  "0.06em",
                boxShadow:
                  "0 8px 22px rgba(18, 63, 132, 0.34)",
              }}
            >
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}

      <InventoryBar />
    </div>
  );
}
