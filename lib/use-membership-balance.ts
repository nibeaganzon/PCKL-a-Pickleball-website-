"use client";

import { useEffect, useState } from "react";

export function useMembershipBalance(cardId: string) {
  const normalizedCardId = cardId.trim().toUpperCase();
  const validCardId = /^PCKL-[0-9A-F]{32}$/.test(normalizedCardId);
  const [result, setResult] = useState<{
    cardId: string;
    balance: number | null;
    error: string;
  }>({ cardId: "", balance: null, error: "" });

  useEffect(() => {
    if (!validCardId) return;

    let active = true;

    async function loadBalance() {
      try {
        const response = await fetch(
          `/api/membership-cards/${encodeURIComponent(normalizedCardId)}`,
          { cache: "no-store" }
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Card balance could not be loaded.");
        }
        if (active) {
          setResult({
            cardId: normalizedCardId,
            balance: Number(result.balance),
            error: "",
          });
        }
      } catch (loadError) {
        if (active) {
          setResult({
            cardId: normalizedCardId,
            balance: null,
            error:
              loadError instanceof Error
                ? loadError.message
                : "Card balance could not be loaded.",
          });
        }
      }
    }

    void loadBalance();
    const intervalId = window.setInterval(() => void loadBalance(), 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [normalizedCardId, validCardId]);

  const isCurrentCard = result.cardId === normalizedCardId;
  return {
    balance: isCurrentCard ? result.balance : null,
    error: isCurrentCard ? result.error : "",
    loading: validCardId && !isCurrentCard,
  };
}
