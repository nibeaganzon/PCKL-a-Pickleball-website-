export type CourtStatus = "Available" | "Maintenance";
export type CourtType = "Indoor" | "Outdoor";

export type CourtInventoryItem = {
  kind: "court";
  id: string;
  name: string;
  description: string;
  courtType: CourtType;
  status: CourtStatus;
  price: number;
  image: string;
  sourceImage?: string;
};

export type EquipmentInventoryItem = {
  kind: "equipment";
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
  sourceImage?: string;
};

export type InventoryItem = CourtInventoryItem | EquipmentInventoryItem;
