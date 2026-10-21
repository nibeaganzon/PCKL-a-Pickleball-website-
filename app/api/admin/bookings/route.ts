import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getPendingOrder,
  normalizeBookingItem,
  readPaymentCart,
  savePendingOrderCart,
} from "./_shared";

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();
    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        "id, order_reference, customer_name, customer_email, amount, cart, status, payment_type, created_at"
      )
      .eq("status", "pending")
      .eq("payment_type", "order")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const bookings = (payments ?? []).flatMap((payment) => {
      const cart = readPaymentCart(payment.cart);
      if (!cart) {
        throw new Error(`Pending order ${payment.id} has an invalid cart.`);
      }

      return cart.map((item, itemIndex) => ({
        paymentId: payment.id,
        orderReference: payment.order_reference,
        customerName: payment.customer_name,
        customerEmail: payment.customer_email,
        amount: Number(payment.amount),
        itemIndex,
        item,
      }));
    });

    return Response.json(
      { bookings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Pending bookings could not be loaded:", error);
    return Response.json(
      { message: "Pending bookings could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ message: "Invalid booking details." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (
      typeof input.paymentId !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.paymentId)
    ) {
      return Response.json({ message: "Choose a valid pending order." }, { status: 400 });
    }

    const item = normalizeBookingItem(input.item);
    if (!item) {
      return Response.json({ message: "Enter valid booking details." }, { status: 400 });
    }

    const { order, reason } = await getPendingOrder(input.paymentId);
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

    if (order.cart.length >= 20) {
      return Response.json(
        { message: "An order cannot contain more than 20 booking items." },
        { status: 409 }
      );
    }

    const updated = await savePendingOrderCart(order, [...order.cart, item]);
    if (!updated) {
      return Response.json(
        { message: "The order changed or payment review started. Refresh and try again." },
        { status: 409 }
      );
    }

    return Response.json({ message: "Booking added to the pending order." });
  } catch (error) {
    console.error("Booking could not be created:", error);
    return Response.json(
      { message: "The booking could not be created." },
      { status: 500 }
    );
  }
}
