import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  if (!/^PCKL-[0-9A-F]{32}$/i.test(cardId)) {
    return Response.json({ message: "Membership card not found." }, { status: 404 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: card, error } = await supabase
      .from("membership_cards")
      .select("card_id, balance")
      .eq("card_id", cardId.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!card) {
      return Response.json({ message: "Membership card not found." }, { status: 404 });
    }

    return Response.json(
      { cardId: card.card_id, balance: Number(card.balance) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Membership card balance could not be loaded:", error);
    return Response.json(
      { message: "Membership card balance could not be loaded." },
      { status: 500 }
    );
  }
}
