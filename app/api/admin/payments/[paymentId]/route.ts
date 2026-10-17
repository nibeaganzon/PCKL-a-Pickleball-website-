import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const { paymentId } = await context.params;
    if (
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(paymentId)
    ) {
      return Response.json({ message: "Invalid payment ID." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid request body." }, { status: 400 });
    }
    const status =
      body && typeof body === "object" && "status" in body
        ? body.status
        : undefined;
    if (status !== "confirmed" && status !== "rejected") {
      return Response.json({ message: "Choose confirm or reject." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("review_payment", {
      p_payment_id: paymentId,
      p_status: status,
      p_reviewed_by: authorization.user.id,
    });

    if (error?.message.includes("PAYMENT_NOT_FOUND")) {
      return Response.json({ message: "Payment not found." }, { status: 404 });
    }
    if (error?.message.includes("PAYMENT_ALREADY_REVIEWED")) {
      return Response.json(
        { message: "This payment has already been reviewed." },
        { status: 409 }
      );
    }
    if (error) throw error;

    const payment = Array.isArray(data) ? data[0] : data;
    if (!payment) {
      throw new Error("Payment review completed without returning the updated payment.");
    }

    return Response.json({ payment });
  } catch (error) {
    console.error("Payment review failed:", error);
    return Response.json({ message: "The payment could not be updated." }, { status: 500 });
  }
}
