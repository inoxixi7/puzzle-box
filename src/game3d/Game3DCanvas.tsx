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
  HintIcon,
  SoundIcon,
  LandscapeIcon,
  SpinDiskIcon,
  TapFaceIcon,
  TurnBoxIcon,
} from "./HudIcons";

import {
  useGameStore,
} from "../store/useGameStore";
import { PALETTE, css } from "./palette";
import { isMuted, setMuted } from "./sound";

export function Game3DCanvas() {
  const hostRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const gameRef =
    useRef<
      PuzzleBox3D | null
    >(null);

  const [muted, setMutedState] = useState(isMuted);

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

      {!finalSolved && !focusedFace && (
        <button
          type="button"
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          className="hud-icon-button slot-2"
          data-hud="top"
          aria-label={muted ? "音を出す" : "消音"}
          aria-pressed={muted}
        >
          <SoundIcon muted={muted} />
        </button>
      )}

      {!finalSolved && (
        <button
          type="button"
          onClick={() => {
            gameRef.current
              ?.hint();
          }}
          className={`hud-icon-button${focusedFace ? " slot-2" : ""}`}
          data-hud="top"
          aria-label="ヒント"
        >
          <HintIcon />
        </button>
      )}

      {focusedFace && (
        <>
          {focusedFace === "front" && !frontSolved && (
            <div
              className="hud-top-label"
              data-hud="top"
              role="img"
              aria-label="円盤をドラッグして回す"
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
          >
            <BackIcon />
          </button>
        </>
      )}

      {/* The ending is the stone itself, turning over the open box: nothing
          covers it, only a replay arrow fades in underneath. */}
      {finalSolved && (
        <button
          type="button"
          className="ending-replay"
          aria-label="もう一度遊ぶ"
          onClick={() => {
            window.location.reload();
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
      )}

      <InventoryBar />
    </div>
  );
}
