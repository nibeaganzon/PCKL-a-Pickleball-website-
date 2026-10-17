import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();
    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        "id, order_reference, customer_name, customer_email, payment_reference, cart, amount, proof_path, status, payment_type, payment_method, membership_card_id, balance_after, created_at, reviewed_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const paymentsWithProof = await Promise.all(
      (payments ?? []).map(async (payment) => {
        if (!payment.proof_path) {
          throw new Error(`Pending payment ${payment.id} has no receipt path.`);
        }
        const { data, error: proofError } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(payment.proof_path, 5 * 60);

        if (proofError) throw proofError;
        return { ...payment, proof_url: data.signedUrl };
      })
    );

    return Response.json(
      { payments: paymentsWithProof, adminEmail: authorization.user.email },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Pending payments could not be loaded:", error);
    return Response.json({ message: "Pending payments could not be loaded." }, { status: 500 });
  }
}
