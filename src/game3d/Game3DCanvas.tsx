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
  BackIcon,
  LandscapeIcon,
  SpinDiskIcon,
  TapFaceIcon,
  TurnBoxIcon,
} from "./HudIcons";

import {
  useGameStore,
} from "../store/useGameStore";
import { PALETTE, css } from "./palette";

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

          onMazeSolved: () =>
            markPuzzleSolved("front"),
          onNfcSolved: () =>
            markPuzzleSolved("nfc"),
          onCornerGearSolved: () =>
            markPuzzleSolved("cornerGear"),
          onTouchKeysSolved: () =>
            markPuzzleSolved("touchKeys"),
          onFinalSolved: () =>
            markPuzzleSolved("final"),

          onCardPickedUp: () => {
            addItem(
              "nfc-card",
            );
          },

          onPuckPickedUp: () => {
            addItem(
              "magnet-puck",
            );
          },

          onTokenPickedUp: () => {
            addItem("key-token");
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

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [
    addItem,
    markPuzzleSolved,
  ]);

  return (
    <div
      ref={hostRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: css(PALETTE.night),
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
          <span className="hud-icons" role="img" aria-label="ドラッグで箱を回す・面をタップして調べる">
            <TurnBoxIcon />
            <TapFaceIcon />
          </span>

          <span className="hud-sub-hint" role="img" aria-label="横向きにすると遊びやすくなります">
            <LandscapeIcon />
          </span>
        </div>
      )}

      {focusedFace && (
        <>
          {focusedFace === "front" && !frontSolved && (
            <div
              className="hud-top-label has-button"
              data-hud="top"
              role="img"
              aria-label="円盤をドラッグして回す"
              style={{
                color:
                  "rgba(232, 220, 198, 0.88)",
                background:
                  "rgba(14, 12, 10, 0.58)",
                border:
                  "1px solid rgba(183, 145, 88, 0.32)",
              }}
            >
              <span className="hud-icons">
                <SpinDiskIcon />
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              gameRef.current
                ?.exitFocus();
            }}
            className="hud-back-button"
            data-hud="top"
            aria-label="観察に戻る"
            style={{
              border:
                "1px solid rgba(183, 145, 88, 0.48)",
              background:
                "rgba(24, 18, 13, 0.84)",
              color:
                "#e7d3ad",
            }}
          >
            <BackIcon />
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
                "min(300px, calc(100vw - 40px))",
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
            {/* No words: the gem, and a replay arrow. */}
            <svg
              viewBox="0 0 120 140"
              width="120"
              height="140"
              aria-hidden="true"
              style={{
                display: "block",
                margin: "0 auto 28px",
                filter:
                  "drop-shadow(0 0 22px rgba(220, 235, 255, 0.6))",
              }}
            >
              {/* Brilliant cut seen from the side: table, crown, pavilion. */}
              <polygon points="38,28 82,28 112,56 60,132 8,56" fill="#e8f1ff" />
              <polygon points="38,28 82,28 72,56 48,56" fill="#ffffff" />
              <polygon points="38,28 48,56 8,56" fill="#c9dcff" />
              <polygon points="82,28 112,56 72,56" fill="#dfe9ff" />
              <polygon points="8,56 48,56 60,132" fill="#b4ccf5" />
              <polygon points="48,56 72,56 60,132" fill="#f4f8ff" />
              <polygon points="72,56 112,56 60,132" fill="#9fbdf0" />
              <g fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2">
                <polyline points="38,28 82,28 112,56 60,132 8,56 38,28" />
                <line x1="8" y1="56" x2="112" y2="56" />
              </g>
              {/* Glints. */}
              <path d="M94 14 L96 22 L104 24 L96 26 L94 34 L92 26 L84 24 L92 22 Z" fill="#ffffff" />
              <path d="M26 86 L27.5 91 L32 92.5 L27.5 94 L26 99 L24.5 94 L20 92.5 L24.5 91 Z" fill="#ffffff" />
            </svg>

            <button
              type="button"
              aria-label="もう一度遊ぶ"
              onClick={() => {
                window.location.reload();
              }}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border:
                  "1px solid rgba(115, 170, 244, 0.72)",
                background:
                  "rgba(41, 91, 161, 0.72)",
                color: "#ffffff",
                cursor: "pointer",
                display: "inline-grid",
                placeItems: "center",
                boxShadow:
                  "0 8px 22px rgba(18, 63, 132, 0.34)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v5h-5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <InventoryBar />
    </div>
  );
}
