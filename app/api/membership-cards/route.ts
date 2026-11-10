import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId")?.trim() || "";
    const targetUserId = user?.id || userIdParam;

    if ((authError && !targetUserId) || !targetUserId) {
      return Response.json({ message: "Sign in required." }, { status: 401 });
    }

    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(targetUserId)) {
      return Response.json({ message: "Invalid user ID." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: card, error } = await supabase
      .from("membership_cards")
      .select("id, card_number, balance, status")
      .eq("user_id", targetUserId)
      .eq("status", "Active")
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!card) {
      return Response.json({ message: "Membership card not found." }, { status: 404 });
    }

    return Response.json(
      {
        card: {
          id: card.id,
          card_number: card.card_number || card.id,
          balance: Number(card.balance ?? 0),
          status: card.status,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Active membership card could not be loaded:", error);
    return Response.json(
      { message: "Membership card could not be loaded." },
      { status: 500 }
    );
  }
}
