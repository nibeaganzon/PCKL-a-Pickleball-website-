import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  const trimmed = cardId.trim();
  if (!/^(?:P[C|I]KL-[A-Z0-9]{8,32}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(trimmed)) {
    return Response.json({ message: "Membership card not found." }, { status: 404 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const isUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(trimmed);

    let query = supabase
      .from("membership_cards")
      .select("id, card_number, balance, status")
      .eq("status", "Active");

    if (isUuid) {
      query = query.eq("id", trimmed);
    } else {
      query = query.eq("card_number", trimmed.toUpperCase());
    }

    const { data: card, error } = await query.maybeSingle();

    if (error) throw error;
    if (!card) {
      return Response.json({ message: "Membership card not found." }, { status: 404 });
    }

    return Response.json(
      { cardId: card.card_number || card.id, balance: Number(card.balance) },
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
