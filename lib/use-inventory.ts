"use client";

import { useCallback, useEffect, useState } from "react";
import type { CourtInventoryItem, EquipmentInventoryItem } from "./inventory";

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
      setCourts(result.courts);
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

  return { courts, equipment, loading, error, refresh: loadInventory };
}
