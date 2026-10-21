export type CartItem = {
  id: string;
  inventoryId?: string;
  type: "court" | "equipment";
  name: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationHours: number;
  quantity: number;
  unitPrice: number;
  image?: string;
};

export const CART_KEY = "pckl_cart";
const LEGACY_EQUIPMENT_CART_KEY = "pckl-equipment-cart";
export const CART_UPDATED_EVENT = "pckl-cart-updated";

function normalizeCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.quantity !== "number" ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1
  ) {
    return null;
  }

  const legacyEquipment =
    item.type === undefined &&
    (item.id === "paddle" || item.id === "ball") &&
    typeof item.price === "number";
  const type = legacyEquipment ? "equipment" : item.type;
  const durationHours =
    typeof item.durationHours === "number"
      ? item.durationHours
      : typeof item.hours === "number"
        ? item.hours
        : 1;
  const unitPrice =
    typeof item.unitPrice === "number"
      ? item.unitPrice
      : typeof item.price === "number"
        ? item.price
        : 0;

  if (
    (type !== "court" && type !== "equipment") ||
    !Number.isInteger(durationHours) ||
    durationHours < 1 ||
    durationHours > 24 ||
    unitPrice <= 0
  ) {
    return null;
  }

  return {
    id: item.id,
    inventoryId:
      typeof item.inventoryId === "string" ? item.inventoryId : undefined,
    type,
    name: item.name,
    date: typeof item.date === "string" ? item.date : undefined,
    startTime: typeof item.startTime === "string" ? item.startTime : undefined,
    endTime: typeof item.endTime === "string" ? item.endTime : undefined,
    durationHours,
    quantity: item.quantity,
    unitPrice,
    image: typeof item.image === "string" ? item.image : undefined,
  };
}

export function readCart(): CartItem[] {
  const rawCart = localStorage.getItem(CART_KEY);
  const parsedCart: unknown = rawCart ? JSON.parse(rawCart) : [];
  if (!Array.isArray(parsedCart)) {
    throw new Error("The saved cart has an invalid format.");
  }
  const cart = parsedCart.map(normalizeCartItem);
  if (cart.some((item) => item === null)) {
    throw new Error("The saved cart contains invalid items.");
  }

  const legacyValue = localStorage.getItem(LEGACY_EQUIPMENT_CART_KEY);
  if (!legacyValue) return cart as CartItem[];

  const legacyItems: unknown = JSON.parse(legacyValue);
  if (!Array.isArray(legacyItems)) {
    throw new Error("The saved equipment cart has an invalid format.");
  }
  const normalizedLegacy = legacyItems.map(normalizeCartItem);
  if (
    normalizedLegacy.some(
      (item) => !item || item.type !== "equipment"
    )
  ) {
    throw new Error("The saved equipment cart contains invalid items.");
  }

  return [...(cart as CartItem[]), ...(normalizedLegacy as CartItem[])];
}

export function writeCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  localStorage.removeItem(LEGACY_EQUIPMENT_CART_KEY);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function countCartItems(cart: CartItem[]) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function getCartItemCount() {
  try {
    return countCartItems(readCart());
  } catch {
    return 0;
  }
}
