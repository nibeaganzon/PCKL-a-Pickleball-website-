import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
        status,
        total_amount,
        transaction_date,
        reviewed_at,
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
      const cardRef = (trans.membership_cards as unknown as { card_number: string })?.card_number || trans.card_id;
      const reservations = (trans.court_reservations as unknown as Array<{
        id: string;
        amount: number;
        start_date: string;
        end_date: string;
        courts: { name: string };
      }>) || [];
      const rentals = (trans.equipment_rentals as unknown as Array<{
        id: string;
        quantity: number;
        unit_price: number;
        equipments: { name: string };
      }>) || [];

      const cart = [
        ...reservations.map((r) => ({
          id: r.id,
          type: "court" as const,
          name: r.courts?.name || "Court",
          date: r.start_date?.split("T")[0],
          startTime: r.start_date ? new Date(r.start_date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
          endTime: r.end_date ? new Date(r.end_date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
          durationHours: 1,
          quantity: 1,
          unitPrice: Number(r.amount),
        })),
        ...rentals.map((er) => ({
          id: er.id,
          type: "equipment" as const,
          name: er.equipments?.name || "Equipment",
          durationHours: 1,
          quantity: er.quantity,
          unitPrice: Number(er.unit_price),
        })),
      ];

      return Response.json(
        {
          payment: {
            order_reference: trans.order_reference,
            status: (trans.status || "Pending").toLowerCase(),
            created_at: trans.transaction_date,
            reviewed_at: trans.reviewed_at,
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
        amount,
        topup_date,
        card_id,
        membership_cards (
          card_number
        )
      `)
      .eq("order_reference", ref)
      .maybeSingle();

    if (topupError) throw topupError;

    if (topup) {
      const cardRef = (topup.membership_cards as unknown as { card_number: string })?.card_number || topup.card_id;
      return Response.json(
        {
          payment: {
            order_reference: topup.order_reference,
            status: "confirmed",
            created_at: topup.topup_date,
            reviewed_at: topup.topup_date,
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
