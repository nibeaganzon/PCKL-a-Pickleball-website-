import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  try {
    void request;
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();

    // Load pending transactions
    const { data: transactions, error: transError } = await supabase
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
      .eq("status", "Pending")
      .order("transaction_date", { ascending: false })
      .limit(100);

    if (transError) throw transError;

    // Load pending topups
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

    // Load auth user emails for membership cards
    const userIds = Array.from(
      new Set([
        ...(transactions ?? [])
          .map((t) => (t.membership_cards as unknown as { user_id: string })?.user_id)
          .filter(Boolean),
        ...(topups ?? [])
          .map((t) => (t.membership_cards as unknown as { user_id: string })?.user_id)
          .filter(Boolean),
      ])
    );

    const emailMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of usersData?.users || []) {
        if (u.email) emailMap.set(u.id, u.email);
      }
    }

    const orderPayments = (transactions ?? []).map((trans) => {
      const cardInfo = trans.membership_cards as unknown as { card_number: string; user_id: string } | null;
      const userEmail = cardInfo?.user_id ? emailMap.get(cardInfo.user_id) || "member@pckl.ph" : "member@pckl.ph";
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

      return {
        id: trans.id,
        order_reference: trans.order_reference,
        customer_name: "PCKL Member",
        customer_email: userEmail,
        payment_reference: trans.order_reference,
        cart,
        amount: Number(trans.total_amount),
        proof_path: null,
        proof_url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85",
        status: "pending" as const,
        payment_type: "order" as const,
        payment_method: "membership_card" as const,
        membership_card_id: cardInfo?.card_number || trans.card_id,
        balance_after: null,
        created_at: trans.transaction_date,
        reviewed_at: trans.reviewed_at,
      };
    });

    const topupPayments = await Promise.all(
      (topups ?? []).map(async (topup) => {
        const cardInfo = topup.membership_cards as unknown as { card_number: string; user_id: string } | null;
        const userEmail = cardInfo?.user_id ? emailMap.get(cardInfo.user_id) || "member@pckl.ph" : "member@pckl.ph";

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
          customer_name: "PCKL Member",
          customer_email: userEmail,
          payment_reference: topup.order_reference,
          cart: [],
          amount: Number(topup.amount),
          proof_path: topup.proof_path,
          proof_url: proofUrl || "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85",
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

    const payments = [...orderPayments, ...topupPayments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
    console.error("Pending payments could not be loaded:", error);
    return Response.json({ message: "Pending payments could not be loaded." }, { status: 500 });
  }
}
