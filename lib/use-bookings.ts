"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MemberBookingOrder = {
  id: string;
  orderReference: string;
  reservations: {
    id: string;
    courtName: string;
    image: string;
    startDate: string;
    endDate: string;
    amount: number;
  }[];
  rentals: {
    id: string;
    equipmentName: string;
    image: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }[];
};

type BookingResult = {
  cardId: string;
  orders: MemberBookingOrder[];
  error: string;
};

function getRelatedInventory(
  relation:
    | { name: string; images: string[] | null }
    | { name: string; images: string[] | null }[]
    | null
    | undefined
) {
  const item = Array.isArray(relation) ? relation[0] : relation;
  return {
    name: item?.name ?? "Unavailable",
    image: item?.images?.[0] ?? "",
  };
}

export function useBookings(cardId: string | undefined) {
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    if (!cardId) return;

    const activeCardId = cardId;
    let active = true;

    async function loadBookings() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("transactions")
          .select(`
            id,
            order_reference,
            transaction_type,
            transaction_date,
            court_reservations (
              id,
              amount,
              start_date,
              end_date,
              status,
              courts (name, images)
            ),
            equipment_rentals (
              id,
              quantity,
              start_date,
              end_date,
              status,
              equipments (name, images)
            )
          `)
          .eq("card_id", activeCardId)
          .eq("transaction_type", "Checkout")
          .order("transaction_date", { ascending: false })
          .limit(20);

        if (error) throw error;

        const orders = (data ?? [])
          .map((transaction) => {
            const reservations = (transaction.court_reservations ?? [])
              .filter((reservation) => reservation.status === "Active")
              .map((reservation) => {
                const court = getRelatedInventory(reservation.courts);
                return {
                  id: reservation.id,
                  courtName: court.name,
                  image: court.image,
                  startDate: reservation.start_date,
                  endDate: reservation.end_date,
                  amount: Number(reservation.amount),
                };
              });
            const rentals = (transaction.equipment_rentals ?? [])
              .filter((rental) => rental.status === "Active")
              .map((rental) => {
                const equipment = getRelatedInventory(rental.equipments);
                return {
                  id: rental.id,
                  equipmentName: equipment.name,
                  image: equipment.image,
                  startDate: rental.start_date,
                  endDate: rental.end_date,
                  quantity: Number(rental.quantity),
                };
              });

            return {
              id: transaction.id,
              orderReference: transaction.order_reference ?? "",
              reservations,
              rentals,
            };
          })
          .filter(
            (order) =>
              order.orderReference &&
              (order.reservations.length > 0 || order.rentals.length > 0)
          );

        if (active) setResult({ cardId: activeCardId, orders, error: "" });
      } catch (loadError) {
        console.error("Failed to load member bookings:", loadError);
        if (active) {
          setResult({
            cardId: activeCardId,
            orders: [],
            error: "Your bookings could not be loaded. Please try again later.",
          });
        }
      }
    }

    void loadBookings();

    return () => {
      active = false;
    };
  }, [cardId]);

  if (!cardId) return { orders: [], error: "", loading: false };
  if (result?.cardId !== cardId) {
    return { orders: [], error: "", loading: true };
  }

  return { orders: result.orders, error: result.error, loading: false };
}
