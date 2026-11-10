import { createSupabaseServiceClient } from "@/lib/supabase/service";

function formatBookingDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatBookingTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function getBookingDuration(start: string, end: string) {
  const duration = (Date.parse(end) - Date.parse(start)) / (60 * 60 * 1000);
  return Number.isFinite(duration) && duration > 0
    ? Math.max(1, Math.round(duration))
    : 1;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderReference: string }> }
) {
  const { orderReference } = await context.params;
  const ref = orderReference.trim().toUpperCase();

  try {
    const supabase = createSupabaseServiceClient();

    // Check transactions
    const { data: trans, error: transError } = await supabase
      .from("transactions")
      .select(`
        id,
        order_reference,
        total_amount,
        transaction_date,
        card_id,
        membership_cards (
          card_number
        ),
        court_reservations (
          id,
          amount,
          start_date,
          end_date,
          status,
          courts (
            name
          )
        ),
        equipment_rentals (
          id,
          quantity,
          unit_price,
          start_date,
          end_date,
          status,
          equipments (
            name
          )
        )
      `)
      .eq("order_reference", ref)
      .maybeSingle();

    if (transError) throw transError;

    if (trans) {
      const cardRef =
        (trans.membership_cards as unknown as { card_number: string })?.card_number ||
        trans.card_id;
      const reservations =
        (trans.court_reservations as unknown as Array<{
          id: string;
          amount: number;
          start_date: string;
          end_date: string;
          courts: { name: string };
        }>) || [];
      const rentals =
        (trans.equipment_rentals as unknown as Array<{
          id: string;
          quantity: number;
          unit_price: number;
          start_date: string;
          end_date: string;
          equipments: { name: string };
        }>) || [];

      const cart = [
        ...reservations.map((r) => {
          const durationHours = getBookingDuration(r.start_date, r.end_date);
          return {
            id: r.id,
            type: "court" as const,
            name: r.courts?.name || "Court",
            date: r.start_date ? formatBookingDate(r.start_date) : "",
            startTime: r.start_date ? formatBookingTime(r.start_date) : "",
            endTime: r.end_date ? formatBookingTime(r.end_date) : "",
            durationHours,
            quantity: 1,
            unitPrice: Number(r.amount) / durationHours,
          };
        }),
        ...rentals.map((er) => {
          const durationHours = getBookingDuration(er.start_date, er.end_date);
          return {
            id: er.id,
            type: "equipment" as const,
            name: er.equipments?.name || "Equipment",
            durationHours,
            quantity: er.quantity,
            unitPrice: Number(er.unit_price),
          };
        }),
      ];

      return Response.json(
        {
          payment: {
            order_reference: trans.order_reference,
            status: "confirmed",
            created_at: trans.transaction_date,
            reviewed_at: null,
            cart,
            amount: Number(trans.total_amount),
            payment_type: "order",
            payment_method: "membership_card",
            membership_card_id: cardRef,
            balance_after: null,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Check topups
    const { data: topup, error: topupError } = await supabase
      .from("topups")
      .select(`
        id,
        order_reference,
        status,
        amount,
        topup_date,
        reviewed_at,
        card_id,
        membership_cards (
          card_number
        )
      `)
      .eq("order_reference", ref)
      .maybeSingle();

    if (topupError) throw topupError;

    if (topup) {
      const cardRef =
        (topup.membership_cards as unknown as { card_number: string })?.card_number ||
        topup.card_id;
      const topupStatus = (topup.status || "Pending").toLowerCase();
      return Response.json(
        {
          payment: {
            order_reference: topup.order_reference,
            status: topupStatus,
            created_at: topup.topup_date,
            reviewed_at: topup.reviewed_at,
            cart: [],
            amount: Number(topup.amount),
            payment_type: "top_up",
            payment_method: "external",
            membership_card_id: cardRef,
            balance_after: null,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json({ message: "Payment not found." }, { status: 404 });
  } catch (error) {
    console.error("Payment status could not be loaded:", error);
    return Response.json(
      { message: "Payment status could not be loaded." },
      { status: 500 }
    );
  }
}
