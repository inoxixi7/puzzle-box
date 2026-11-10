import { create } from "zustand";

import {
  INVENTORY_SIZE,
  type InventoryItemId,
} from "../game3d/inventory/items";

export type PuzzleId =
  | "front"
  | "nfc"
  | "cornerGear"
  | "touchKeys"
  | "final";

type InventorySlot =
  | InventoryItemId
  | null;

type PuzzleState = Record<
  PuzzleId,
  boolean
>;

type GameState = {
  inventory: InventorySlot[];
  selectedItem: InventoryItemId | null;

  lastAcquiredItem: InventoryItemId | null;
  acquisitionSerial: number;

  puzzles: PuzzleState;

  addItem: (
    item: InventoryItemId,
  ) => boolean;

  removeItem: (
    item: InventoryItemId,
  ) => boolean;

  selectItem: (
    item: InventoryItemId | null,
  ) => void;

  clearSelection: () => void;

  markPuzzleSolved: (
    puzzle: PuzzleId,
  ) => void;

  resetGame: () => void;
};

const createEmptyInventory = () =>
  Array<InventorySlot>(
    INVENTORY_SIZE,
  ).fill(null);

const createPuzzleState = (): PuzzleState => ({
  front: false,
  nfc: false,
  cornerGear: false,
  touchKeys: false,
  final: false,
});

export const useGameStore =
  create<GameState>(
    (set, get) => ({
      inventory:
        createEmptyInventory(),

      selectedItem: null,

      lastAcquiredItem: null,
      acquisitionSerial: 0,

      puzzles:
        createPuzzleState(),

      addItem: (
        item,
      ) => {
        const state = get();

        if (
          state.inventory.includes(
            item,
          )
        ) {
          return false;
        }

        const emptyIndex =
          state.inventory.findIndex(
            (slot) =>
              slot === null,
          );

        if (emptyIndex < 0) {
          return false;
        }

        const nextInventory = [
          ...state.inventory,
        ];

        nextInventory[
          emptyIndex
        ] = item;

        set({
          inventory:
            nextInventory,

          lastAcquiredItem:
            item,

          acquisitionSerial:
            state.acquisitionSerial +
            1,
        });

        return true;
      },

      removeItem: (
        item,
      ) => {
        const state = get();

        const index =
          state.inventory.indexOf(
            item,
          );

        if (index < 0) {
          return false;
        }

        const nextInventory = [
          ...state.inventory,
        ];

        nextInventory[
          index
        ] = null;

        set({
          inventory:
            nextInventory,

          selectedItem:
            state.selectedItem ===
            item
              ? null
              : state.selectedItem,
        });

        return true;
      },

      selectItem: (
        item,
      ) => {
        const state = get();

        if (
          item !== null &&
          !state.inventory.includes(
            item,
          )
        ) {
          return;
        }

        set({
          selectedItem:
            state.selectedItem ===
              item
              ? null
              : item,
        });
      },

      clearSelection: () => {
        set({
          selectedItem: null,
        });
      },

      markPuzzleSolved: (
        puzzle,
      ) => {
        const state = get();

        if (
          state.puzzles[
            puzzle
          ]
        ) {
          return;
        }

        set({
          puzzles: {
            ...state.puzzles,
            [puzzle]: true,
          },
        });
      },

      resetGame: () => {
        set({
          inventory:
            createEmptyInventory(),

          selectedItem: null,

          lastAcquiredItem:
            null,

          acquisitionSerial:
            0,

          puzzles:
            createPuzzleState(),
        });
      },
    }),
  );
