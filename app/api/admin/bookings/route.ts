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

    if (error) {
      // Fallback to transactions domain table
      const { data: transactions, error: transError } = await supabase
        .from("transactions")
        .select(`
          id,
          order_reference,
          status,
          total_amount,
          transaction_date,
          membership_cards (
            card_number,
            user_id
          ),
          court_reservations (
            id,
            amount,
            start_date,
            end_date,
            status,
            courts (
              id,
              name
            )
          ),
          equipment_rentals (
            id,
            quantity,
            unit_price,
            status,
            equipments (
              id,
              name
            )
          )
        `)
        .eq("status", "Pending")
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (transError) throw transError;

      const userIds = Array.from(
        new Set(
          (transactions ?? [])
            .map((t) => (t.membership_cards as unknown as { user_id: string })?.user_id)
            .filter(Boolean)
        )
      );

      const emailMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const u of usersData?.users || []) {
          if (u.email) emailMap.set(u.id, u.email);
        }
      }

      const bookings = (transactions ?? []).flatMap((trans) => {
        const cardInfo = trans.membership_cards as unknown as { card_number: string; user_id: string } | null;
        const userEmail = cardInfo?.user_id ? emailMap.get(cardInfo.user_id) || "member@pckl.ph" : "member@pckl.ph";
        const reservations = (trans.court_reservations as unknown as Array<{
          id: string;
          amount: number;
          start_date: string;
          end_date: string;
          courts: { id: string; name: string };
        }>) || [];
        const rentals = (trans.equipment_rentals as unknown as Array<{
          id: string;
          quantity: number;
          unit_price: number;
          equipments: { id: string; name: string };
        }>) || [];

        const items = [];
        let idx = 0;
        for (const r of reservations) {
          items.push({
            paymentId: trans.id,
            orderReference: trans.order_reference,
            customerName: "PCKL Member",
            customerEmail: userEmail,
            amount: Number(trans.total_amount),
            itemIndex: idx++,
            item: {
              id: r.courts?.id || r.id,
              inventoryId: r.courts?.id,
              type: "court" as const,
              name: r.courts?.name || "Court",
              date: r.start_date?.split("T")[0],
              startTime: r.start_date ? new Date(r.start_date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
              endTime: r.end_date ? new Date(r.end_date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
              durationHours: 1,
              quantity: 1,
              unitPrice: Number(r.amount),
            },
          });
        }
        for (const er of rentals) {
          items.push({
            paymentId: trans.id,
            orderReference: trans.order_reference,
            customerName: "PCKL Member",
            customerEmail: userEmail,
            amount: Number(trans.total_amount),
            itemIndex: idx++,
            item: {
              id: er.equipments?.id || er.id,
              inventoryId: er.equipments?.id,
              type: "equipment" as const,
              name: er.equipments?.name || "Equipment",
              durationHours: 1,
              quantity: er.quantity,
              unitPrice: Number(er.unit_price),
            },
          });
        }
        return items;
      });

      return Response.json(
        { bookings },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

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

    const item = await normalizeBookingItem(input.item);
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
