"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "./cart";
import type {
  CourtStatus,
  CourtInventoryItem,
  EquipmentInventoryItem,
  InventoryItem,
} from "./inventory";
import { validatePaymentCart } from "./payments";

type InventoryApiCourt = Omit<CourtInventoryItem, "status"> & {
  status: CourtStatus | "Booked";
};

export type SaveInventoryDraftInput = {
  id?: string;
  kind: "court" | "equipment";
  name: string;
  description: string;
  price: string;
  quantity: string;
  courtType: "Indoor" | "Outdoor";
  status: CourtStatus;
  image: string;
  pendingImage?: File | null;
};

export async function reconcileCartWithInventory(): Promise<{
  cart: CartItem[];
  hasUnavailableItems: boolean;
}> {
  const { readCart, writeCart } = await import("./cart");
  const savedCart = readCart();
  const validatedCart = validatePaymentCart(savedCart);
  if (savedCart.length > 0 && !validatedCart) {
    throw new Error(
      "Your cart contains invalid items. Please review your items."
    );
  }

  const inventoryResponse = await fetch("/api/inventory", {
    cache: "no-store",
  });
  const inventoryResult = await inventoryResponse.json();
  if (!inventoryResponse.ok) {
    throw new Error(
      inventoryResult.message || "Current inventory could not be loaded."
    );
  }

  let hasUnavailableItems = false;
  const currentCart = validatedCart ?? [];
  const refreshedCart: CartItem[] = currentCart.map((item) => {
    if (item.type === "court") {
      const court = (inventoryResult.courts as CourtInventoryItem[]).find(
        (candidate) =>
          candidate.id === item.id ||
          candidate.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!court || court.status !== "Available") {
        hasUnavailableItems = true;
        return item;
      }
      return {
        ...item,
        inventoryId: court.id,
        name: court.name,
        unitPrice: court.price,
        image: court.image,
      };
    }

    const legacyName =
      item.id === "paddle"
        ? "Pickleball Paddle"
        : item.id === "ball"
          ? "Pickleball Ball"
          : item.name;
    const equipment = (
      inventoryResult.equipment as EquipmentInventoryItem[]
    ).find(
      (candidate) =>
        candidate.id === item.id ||
        candidate.name.toLowerCase() === legacyName.toLowerCase()
    );
    if (!equipment) {
      hasUnavailableItems = true;
      return item;
    }
    return {
      ...item,
      id: equipment.id,
      inventoryId: equipment.id,
      name: equipment.name,
      unitPrice: equipment.price,
      image: equipment.image,
    };
  });

  writeCart(refreshedCart);
  return { cart: refreshedCart, hasUnavailableItems };
}

export function useInventory() {
  const [courts, setCourts] = useState<CourtInventoryItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Inventory could not be loaded.");
      }
      setCourts(
        (result.courts as InventoryApiCourt[]).map((court) => ({
          ...court,
          status: court.status === "Booked" ? "Maintenance" : court.status,
        }))
      );
      setEquipment(result.equipment);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Inventory could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const saveInventoryItem = useCallback(
    async (draft: SaveInventoryDraftInput): Promise<string> => {
      let imageUrl = draft.image;

      if (draft.pendingImage) {
        const formData = new FormData();
        formData.append("file", draft.pendingImage);
        formData.append("kind", draft.kind);
        if (draft.id) {
          formData.append("itemId", draft.id);
        }

        const uploadResponse = await fetch("/api/admin/inventory/upload", {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(
            uploadResult.message || "The image could not be saved to storage."
          );
        }
        imageUrl = uploadResult.url;
      }

      const payload = {
        id: draft.id,
        kind: draft.kind,
        name: draft.name,
        description: draft.description,
        courtType: draft.courtType,
        status: draft.status,
        image: imageUrl,
        price: Number(draft.price),
        ...(draft.kind === "equipment"
          ? { quantity: Number(draft.quantity) }
          : {}),
      };

      const response = await fetch(
        draft.id
          ? `/api/admin/inventory/${draft.id}`
          : "/api/admin/inventory",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Inventory could not be saved.");
      }

      await loadInventory();
      return result.message as string;
    },
    [loadInventory]
  );

  const deleteInventoryItem = useCallback(
    async (item: InventoryItem): Promise<string> => {
      const response = await fetch(`/api/admin/inventory/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.message || "Inventory item could not be deleted."
        );
      }
      await loadInventory();
      return result.message as string;
    },
    [loadInventory]
  );

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void loadInventory();
    }, 0);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadInventory();
    }, 5000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
    };
  }, [loadInventory]);

  return {
    courts,
    equipment,
    loading,
    error,
    refresh: loadInventory,
    saveInventoryItem,
    deleteInventoryItem,
  };
}
