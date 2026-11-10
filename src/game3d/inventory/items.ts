export const INVENTORY_SIZE = 5;

export type InventoryItemId =
  | "nfc-card"
  | "magnet-puck"
  | "key-token";

export type InventoryItemDefinition = {
  id: InventoryItemId;
  name: string;
  consumable: boolean;
};

export const INVENTORY_ITEMS: Record<
  InventoryItemId,
  InventoryItemDefinition
> = {
  "nfc-card": {
    id: "nfc-card",
    name: "アクセスカード",
    consumable: true,
  },

  "magnet-puck": {
    id: "magnet-puck",
    name: "磁気パック",
    consumable: true,
  },

  "key-token": {
    id: "key-token",
    name: "キートークン",
    consumable: true,
  },
};

export function getInventoryItem(
  id: InventoryItemId,
) {
  return INVENTORY_ITEMS[id];
}
