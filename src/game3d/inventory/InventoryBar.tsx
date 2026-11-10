import {
  useEffect,
  useState,
} from "react";

import {
  getInventoryItem,
  type InventoryItemId,
} from "./items";

import {
  useGameStore,
} from "../../store/useGameStore";

import { TrayIcon } from "../HudIcons";
import { PALETTE, css } from "../palette";

function ItemIcon({
  item,
}: {
  item: InventoryItemId;
}) {
  if (item === "nfc-card") {
    return (
      <svg width="42" height="32" viewBox="0 0 42 32" aria-hidden="true">
        <rect x="4" y="4" width="34" height="24" rx="3" fill="#e9e8e4" />
        <g fill="none" stroke={css(PALETTE.graphiteLight)} strokeWidth="2" strokeLinecap="round">
          <path d="M12 12 A6 6 0 0 1 12 20" />
          <path d="M16 9 A10 10 0 0 1 16 23" />
        </g>
        <rect x="25" y="8" width="9" height="2" fill={css(PALETTE.amber)} />
      </svg>
    );
  }

  // Hex token with its glowing blue ring.
  if (item === "key-token") {
    return (
      <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
        <polygon points="20,2 35.6,11 35.6,29 20,38 4.4,29 4.4,11" fill="#b9bec5" stroke="#e4e7ea" strokeWidth="1" />
        <circle cx="20" cy="20" r="8" fill="none" stroke={css(PALETTE.tokenBlue)} strokeWidth="3" />
        <circle cx="20" cy="20" r="4" fill="#1a1c20" />
      </svg>
    );
  }

  // Magnetic puck, drawn as it sits docked: tab up, symbols clockwise
  // from it along the engraved arrow.
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
      <rect x="18.5" y="1" width="5" height="5" fill="#aeb3b9" />
      <circle cx="21" cy="21" r="16" fill="#aeb3b9" stroke="#e4e7ea" strokeWidth="1.2" />
      <g fill="none" stroke="#1c1d20" strokeWidth="1.4" strokeLinejoin="round">
        <circle cx="28.5" cy="13.5" r="2.4" />
        <path d="M28.5 25.5 L31.2 30.3 L25.8 30.3 Z" />
        <path d="M13.5 25.5 L16.2 28.2 L13.5 30.9 L10.8 28.2 Z" />
        <rect x="11.3" y="11.3" width="4.4" height="4.4" />
        <path d="M23.5 15.6 A6 6 0 1 1 18.5 15.6" />
      </g>
      <path d="M18.5 15.6 L16.6 13.6 L16.2 16.8 Z" fill="#1c1d20" />
    </svg>
  );
}

export function InventoryBar() {
  const inventory =
    useGameStore(
      (state) =>
        state.inventory,
    );

  const selectedItem =
    useGameStore(
      (state) =>
        state.selectedItem,
    );

  const selectItem =
    useGameStore(
      (state) =>
        state.selectItem,
    );

  const lastAcquiredItem =
    useGameStore(
      (state) =>
        state.lastAcquiredItem,
    );

  const acquisitionSerial =
    useGameStore(
      (state) =>
        state.acquisitionSerial,
    );

  const [
    noticeItem,
    setNoticeItem,
  ] = useState<
    InventoryItemId | null
  >(null);

  const [
    noticeSerial,
    setNoticeSerial,
  ] = useState(
    acquisitionSerial,
  );

  // Show the notice when a new item arrives. Adjusting state during
  // render (instead of in an effect) avoids an extra cascading render.
  if (
    noticeSerial !==
    acquisitionSerial
  ) {
    setNoticeSerial(
      acquisitionSerial,
    );

    setNoticeItem(
      acquisitionSerial > 0
        ? lastAcquiredItem
        : null,
    );
  }

  useEffect(() => {
    if (!noticeItem) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setNoticeItem(null);
        },
        1500,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    noticeItem,
    acquisitionSerial,
  ]);

  return (
    <div className="inventory-root">
      <style>
        {`
          @keyframes inventory-acquired {
            0% { transform: scale(.68); opacity: .25; }
            60% { transform: scale(1.12); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes inventory-notice {
            0% { transform: translateY(8px); opacity: 0; }
            18%, 78% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-5px); opacity: 0; }
          }
        `}
      </style>

      {noticeItem && (
        <div
          key={
            acquisitionSerial
          }
          className="inventory-notice"
          role="img"
          aria-label={`${getInventoryItem(noticeItem).name}を手に入れた`}
        >
          <span aria-hidden="true">+</span>
          <ItemIcon item={noticeItem} />
        </div>
      )}

      <div
        className="inventory-panel"
        data-hud="inventory"
      >
        <div
          className="inventory-header"
          role="img"
          aria-label="持ち物"
        >
          <TrayIcon />
        </div>

        <div className="inventory-slots">
          {inventory.map(
            (
              item,
              index,
            ) => {
              const selected =
                item !== null &&
                item ===
                  selectedItem;

              const justAdded =
                item !== null &&
                item ===
                  lastAcquiredItem;

              const definition =
                item
                  ? getInventoryItem(
                      item,
                    )
                  : null;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={
                    item === null
                  }
                  onClick={() => {
                    if (!item) return;

                    selectItem(
                      item,
                    );
                  }}
                  aria-label={
                    definition
                      ? `${definition.name}を${selected ? "選択解除" : "選択"}`
                      : `空きスロット ${index + 1}`
                  }
                  title={
                    definition
                      ?.name
                  }
                  className="inventory-slot"
                  data-selected={selected || undefined}
                  style={{
                    animation:
                      justAdded &&
                      acquisitionSerial >
                        0
                        ? "inventory-acquired .34s ease-out"
                        : undefined,
                  }}
                >
                  {item && (
                    <ItemIcon
                      item={
                        item
                      }
                    />
                  )}

                  <span className="inventory-slot-number">
                    {index + 1}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
