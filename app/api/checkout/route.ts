import { calculatePaymentTotal, validatePaymentCart } from "@/lib/payments";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid checkout request." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const cart = validatePaymentCart(record.cart);
  const cardId =
    typeof record.cardId === "string" ? record.cardId.trim().toUpperCase() : "";

  if (!cart) {
    return Response.json(
      { message: "Your cart contains invalid items. Please review it and try again." },
      { status: 400 }
    );
  }
  if (
    cart.some(
      (item) =>
        item.type === "court" &&
        (!item.date || !item.startTime || !item.endTime)
    )
  ) {
    return Response.json(
      { message: "Add a date and start time to each court reservation." },
      { status: 400 }
    );
  }
  if (!/^(?:(?:PCKL|PICKL)-[A-Z0-9]{8,32}|[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12})$/i.test(cardId)) {
    return Response.json({ message: "Enter a valid membership card ID." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("charge_membership_card", {
      p_card_id: cardId,
      p_cart: cart,
      p_amount: calculatePaymentTotal(cart),
    });

    if (error) {
      if (error.message.includes("CARD_NOT_FOUND")) {
        return Response.json({ message: "Membership card not found." }, { status: 404 });
      }
      if (error.message.includes("INSUFFICIENT_BALANCE")) {
        return Response.json(
          { message: "Your membership card does not have enough balance." },
          { status: 409 }
        );
      }
      if (error.message.includes("INVALID_CART") || error.message.includes("INVALID_AMOUNT")) {
        return Response.json({ message: "Invalid checkout amount or cart." }, { status: 400 });
      }
      if (
        error.message.includes("court_reservations_no_overlap") ||
        error.code === "23P01"
      ) {
        return Response.json(
          {
            message:
              "One or more selected court times are no longer available. Please choose a different slot.",
          },
          { status: 409 }
        );
      }
      if (
        error.message.includes("COURT_NOT_FOUND") ||
        error.message.includes("EQUIPMENT_NOT_FOUND")
      ) {
        return Response.json(
          { message: "One or more items in your cart could not be found." },
          { status: 400 }
        );
      }
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (
      !result ||
      typeof result.order_reference !== "string" ||
      !Number.isFinite(Number(result.balance_after))
    ) {
      throw new Error("Wallet charge completed without a valid checkout result.");
    }

    return Response.json(
      {
        orderReference: result.order_reference,
        balanceAfter: Number(result.balance_after),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Membership card checkout failed:", error);
    return Response.json(
      { message: "Checkout is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
