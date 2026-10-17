import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderReference: string }> }
) {
  const { orderReference } = await context.params;
  if (!/^PAY-[0-9A-F]{20}$/.test(orderReference)) {
    return Response.json({ message: "Payment not found." }, { status: 404 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: payment, error } = await supabase
      .from("payments")
      .select(
        "order_reference, status, created_at, reviewed_at, cart, amount, payment_type, payment_method, membership_card_id, balance_after"
      )
      .eq("order_reference", orderReference)
      .maybeSingle();

    if (error) throw error;
    if (!payment) {
      return Response.json({ message: "Payment not found." }, { status: 404 });
    }

    return Response.json(
      { payment },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Payment status could not be loaded:", error);
    return Response.json(
      { message: "Payment status could not be loaded." },
      { status: 500 }
    );
  }
}
