import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();

    const { data: topups, error: topupsError } = await supabase
      .from("topups")
      .select(`
        id,
        order_reference,
        amount,
        topup_date,
        reviewed_at,
        proof_path,
        card_id,
        membership_cards (
          card_number,
          user_id
        )
      `)
      .eq("status", "Pending")
      .order("topup_date", { ascending: false })
      .limit(100);

    if (topupsError) throw topupsError;

    const userIds = Array.from(
      new Set(
        (topups ?? [])
          .map((t) => (t.membership_cards as unknown as { user_id: string })?.user_id)
          .filter(Boolean)
      )
    );

    const emailMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of usersData?.users || []) {
        if (u.email) emailMap.set(u.id, u.email);
        const fullName =
          typeof u.user_metadata?.full_name === "string"
            ? u.user_metadata.full_name.trim()
            : "";
        if (fullName) nameMap.set(u.id, fullName);
      }
    }

    const payments = await Promise.all(
      (topups ?? []).map(async (topup) => {
        const cardInfo = topup.membership_cards as unknown as { card_number: string; user_id: string } | null;
        const userEmail = cardInfo?.user_id ? emailMap.get(cardInfo.user_id) || "member@pckl.ph" : "member@pckl.ph";
        const customerName = cardInfo?.user_id ? nameMap.get(cardInfo.user_id) || "PCKL Member" : "PCKL Member";

        let proofUrl: string | undefined;
        if (topup.proof_path) {
          const { data: signedData } = await supabase.storage
            .from("payment-proofs")
            .createSignedUrl(topup.proof_path, 3600);
          proofUrl = signedData?.signedUrl;
        }

        return {
          id: topup.id,
          order_reference: topup.order_reference,
          customer_name: customerName,
          customer_email: userEmail,
          payment_reference: topup.order_reference,
          cart: [],
          amount: Number(topup.amount),
          proof_path: topup.proof_path,
          proof_url:
            proofUrl ||
            "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85",
          status: "pending" as const,
          payment_type: "top_up" as const,
          payment_method: "external" as const,
          membership_card_id: cardInfo?.card_number || topup.card_id,
          balance_after: null,
          created_at: topup.topup_date,
          reviewed_at: topup.reviewed_at,
        };
      })
    );

    return Response.json(
      { payments, adminEmail: authorization.user.email },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (
      (error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION" ||
      (error as { digest?: string })?.digest?.startsWith("NEXT_")
    ) {
      throw error;
    }
    console.error("Pending top-ups could not be loaded:", error);
    return Response.json(
      { message: "Pending top-ups could not be loaded." },
      { status: 500 }
    );
  }
}
