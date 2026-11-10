"use client";

import { useEffect, useState } from "react";

export type TopUpStatusRecord = {
  id: string;
  order_reference: string | null;
  amount: number | string;
  topup_date: string;
  status: string;
};

export function useTopUps(cardId: string | undefined) {
  const [result, setResult] = useState<{
    cardId: string;
    topUps: TopUpStatusRecord[];
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!cardId) return;

    let active = true;
    const loadTopUps = async () => {
      try {
        const response = await fetch(
          `/api/top-ups?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Top-up status could not be loaded.");
        }
        if (active) {
          setResult({
            cardId,
            topUps: (payload.topUps ?? []) as TopUpStatusRecord[],
            error: "",
          });
        }
      } catch (loadError) {
        if (active) {
          setResult({
            cardId,
            topUps: [],
            error:
              loadError instanceof Error
                ? loadError.message
                : "Top-up status could not be loaded.",
          });
        }
      }
    };

    void loadTopUps();
    const intervalId = window.setInterval(() => void loadTopUps(), 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [cardId]);

  return result?.cardId === cardId ? result : null;
}
