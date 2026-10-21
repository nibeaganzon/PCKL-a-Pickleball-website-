import type { PaymentItem } from "@/lib/payments";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function resolveInventoryCart(items: PaymentItem[]) {
  const supabase = createSupabaseServiceClient();
  const [courtsResult, equipmentResult] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, status, price"),
    supabase
      .from("equipments")
      .select("id, name, quantity, price"),
  ]);
  if (courtsResult.error) throw courtsResult.error;
  if (equipmentResult.error) throw equipmentResult.error;

  const courts = courtsResult.data ?? [];
  const equipment = equipmentResult.data ?? [];
  const equipmentQuantities = new Map<string, number>();
  const resolved: PaymentItem[] = [];

  for (const item of items) {
    const canonicalItem = { ...item };
    delete canonicalItem.inventoryId;

    if (item.type === "court") {
      const court =
        courts.find(
          (candidate) => candidate.id === (item.inventoryId ?? item.id)
        ) ??
        courts.find(
          (candidate) =>
            candidate.name.toLocaleLowerCase() === item.name.toLocaleLowerCase()
        );
      if (!court) {
        return { items: null, message: `${item.name} is no longer available.` };
      }
      if (court.status !== "Available") {
        return { items: null, message: `${court.name} is not available to book.` };
      }
      if (item.quantity !== 1) {
        return { items: null, message: "A court reservation quantity must be one." };
      }
      resolved.push({
        ...canonicalItem,
        id: court.id,
        name: court.name,
        unitPrice: Number(court.price),
      });
      continue;
    }

    const legacyName =
      item.id === "paddle"
        ? "Pickleball Paddle"
        : item.id === "ball"
          ? "Pickleball Ball"
          : null;
    const rental =
      equipment.find(
        (candidate) => candidate.id === (item.inventoryId ?? item.id)
      ) ??
      equipment.find(
        (candidate) =>
          candidate.name.toLocaleLowerCase() ===
          (legacyName ?? item.name).toLocaleLowerCase()
      );
    if (!rental) {
      return { items: null, message: `${item.name} is no longer available.` };
    }

    const quantity = (equipmentQuantities.get(rental.id) ?? 0) + item.quantity;
    if (quantity > Number(rental.quantity)) {
      return {
        items: null,
        message: `Only ${Number(rental.quantity)} ${rental.name.toLowerCase()}${Number(rental.quantity) === 1 ? "" : "s"} available.`,
      };
    }
    equipmentQuantities.set(rental.id, quantity);
    resolved.push({
      ...canonicalItem,
      id: rental.id,
      name: rental.name,
      unitPrice: Number(rental.price),
    });
  }

  return { items: resolved, message: "" };
}
