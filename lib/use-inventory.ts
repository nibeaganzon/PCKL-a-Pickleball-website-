"use client";

import { useCallback, useEffect, useState } from "react";
import type { CourtInventoryItem, EquipmentInventoryItem } from "./inventory";
import {
  getLocalInventoryImage,
  LOCAL_INVENTORY_IMAGES_UPDATED_EVENT,
  readLocalInventoryImages,
} from "./local-inventory-images";

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
      let localImages: Record<string, string> = {};
      try {
        localImages = await readLocalInventoryImages();
      } catch (imageError) {
        console.error("Locally saved inventory images could not be loaded:", imageError);
      }
      setCourts(
        result.courts.map((court: CourtInventoryItem) => ({
          ...court,
          sourceImage: court.image,
          image:
            getLocalInventoryImage(localImages, "court", court.id) ??
            court.image,
        }))
      );
      setEquipment(
        result.equipment.map((item: EquipmentInventoryItem) => ({
          ...item,
          sourceImage: item.image,
          image:
            getLocalInventoryImage(localImages, "equipment", item.id) ??
            item.image,
        }))
      );
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

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void loadInventory();
    }, 0);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadInventory();
    }, 5000);
    const refreshLocalImages = () => void loadInventory();
    window.addEventListener(
      LOCAL_INVENTORY_IMAGES_UPDATED_EVENT,
      refreshLocalImages
    );
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.removeEventListener(
        LOCAL_INVENTORY_IMAGES_UPDATED_EVENT,
        refreshLocalImages
      );
    };
  }, [loadInventory]);

  return { courts, equipment, loading, error, refresh: loadInventory };
}
