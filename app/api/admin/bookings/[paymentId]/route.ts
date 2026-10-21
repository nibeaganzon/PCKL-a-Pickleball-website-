import { requireAdmin } from "@/lib/admin-auth";
import {
  getPendingOrder,
  normalizeBookingItem,
  savePendingOrderCart,
} from "../_shared";

function validPaymentId(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

async function readRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const { paymentId } = await context.params;
    if (!validPaymentId(paymentId)) {
      return Response.json({ message: "Invalid payment ID." }, { status: 400 });
    }

    const body = await readRequestBody(request);
    if (!body || typeof body !== "object") {
      return Response.json({ message: "Invalid request body." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const itemIndex = input.itemIndex;
    const item = normalizeBookingItem(input.item, true);
    if (
      typeof itemIndex !== "number" ||
      !Number.isInteger(itemIndex) ||
      itemIndex < 0 ||
      !item
    ) {
      return Response.json({ message: "Enter valid booking details." }, { status: 400 });
    }

    const { order, reason } = await getPendingOrder(paymentId);
    if (!order) {
      if (reason === "not-found") {
        return Response.json({ message: "Order not found." }, { status: 404 });
      }
      if (reason === "not-editable") {
        return Response.json(
          { message: "Only pending customer orders can be changed." },
          { status: 409 }
        );
      }
      return Response.json({ message: "The order cart is invalid." }, { status: 409 });
    }
    if (itemIndex >= order.cart.length) {
      return Response.json({ message: "Booking item not found." }, { status: 404 });
    }

    const cart = [...order.cart];
    cart[itemIndex] = item;
    const updated = await savePendingOrderCart(order, cart);
    if (!updated) {
      return Response.json(
        { message: "The order changed or payment review started. Refresh and try again." },
        { status: 409 }
      );
    }

    return Response.json({ message: "Booking updated." });
  } catch (error) {
    console.error("Booking could not be updated:", error);
    return Response.json(
      { message: "The booking could not be updated." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const { paymentId } = await context.params;
    if (!validPaymentId(paymentId)) {
      return Response.json({ message: "Invalid payment ID." }, { status: 400 });
    }

    const itemIndexValue = new URL(request.url).searchParams.get("itemIndex");
    const itemIndex = itemIndexValue === null ? Number.NaN : Number(itemIndexValue);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return Response.json({ message: "Choose a valid booking item." }, { status: 400 });
    }

    const { order, reason } = await getPendingOrder(paymentId);
    if (!order) {
      if (reason === "not-found") {
        return Response.json({ message: "Order not found." }, { status: 404 });
      }
      if (reason === "not-editable") {
        return Response.json(
          { message: "Only pending customer orders can be changed." },
          { status: 409 }
        );
      }
      return Response.json({ message: "The order cart is invalid." }, { status: 409 });
    }
    if (itemIndex >= order.cart.length) {
      return Response.json({ message: "Booking item not found." }, { status: 404 });
    }
    if (order.cart.length === 1) {
      return Response.json(
        {
          message:
            "An order must keep at least one booking item so its pending payment can still be reviewed.",
        },
        { status: 409 }
      );
    }

    const cart = order.cart.filter((_, index) => index !== itemIndex);
    const updated = await savePendingOrderCart(order, cart);
    if (!updated) {
      return Response.json(
        { message: "The order changed or payment review started. Refresh and try again." },
        { status: 409 }
      );
    }

    return Response.json({ message: "Booking removed from the pending order." });
  } catch (error) {
    console.error("Booking could not be deleted:", error);
    return Response.json(
      { message: "The booking could not be deleted." },
      { status: 500 }
    );
  }
}
