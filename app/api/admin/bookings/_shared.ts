import {
  calculatePaymentTotal,
  type PaymentItem,
  validatePaymentCart,
} from "@/lib/payments";
import { resolveInventoryCart } from "@/lib/resolve-inventory-cart";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type PendingOrder = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  cart: PaymentItem[];
};

export async function normalizeBookingItem(
  value: unknown,
  allowPastBookings = false
): Promise<PaymentItem | null> {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "court" && candidate.type !== "equipment") {
    return null;
  }

  const validated = validatePaymentCart([candidate], { allowPastBookings });
  if (!validated) return null;
  const resolved = await resolveInventoryCart(validated);
  return resolved.items?.[0] ?? null;
}

export function readPaymentCart(value: unknown): PaymentItem[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 20 ||
    value.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        ((item as Record<string, unknown>).type !== "court" &&
          (item as Record<string, unknown>).type !== "equipment")
    )
  ) {
    return null;
  }

  return value as PaymentItem[];
}

export async function getPendingOrder(paymentId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, order_reference, customer_name, customer_email, amount, cart, status, payment_type"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { order: null, reason: "not-found" as const };
  if (data.status !== "pending" || data.payment_type !== "order") {
    return { order: null, reason: "not-editable" as const };
  }

  const cart = readPaymentCart(data.cart);
  if (!cart) {
    return { order: null, reason: "invalid-cart" as const };
  }

  return {
    order: {
      id: data.id,
      order_reference: data.order_reference,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      amount: Number(data.amount),
      cart,
    } satisfies PendingOrder,
    reason: null,
  };
}

export async function savePendingOrderCart(
  order: PendingOrder,
  cart: PaymentItem[]
) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ cart, amount: calculatePaymentTotal(cart) })
    .eq("id", order.id)
    .eq("status", "pending")
    .eq("payment_type", "order")
    .eq("cart", JSON.stringify(order.cart))
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
