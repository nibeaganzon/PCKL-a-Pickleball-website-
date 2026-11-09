import { createSupabaseServiceClient } from "@/lib/supabase/service";

const maxProofSize = 5 * 1024 * 1024;
const allowedProofTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const amountPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export async function POST(request: Request) {
  let proofPath: string | undefined;
  let supabase: ReturnType<typeof createSupabaseServiceClient> | undefined;

  try {
    const formData = await request.formData();
    const cardIdValue = formData.get("cardId");
    const amountValue = formData.get("amount");
    const referenceValue = formData.get("paymentReference");
    const proof = formData.get("paymentProof");

    if (
      typeof cardIdValue !== "string" ||
      typeof amountValue !== "string" ||
      typeof referenceValue !== "string" ||
      !(proof instanceof File)
    ) {
      return Response.json(
        { message: "Enter the card ID, amount, payment reference, and receipt." },
        { status: 400 }
      );
    }

    const cardId = cardIdValue.trim().toUpperCase();
    const reference = referenceValue.trim();
    if (!/^(?:(?:PCKL|PICKL)-[A-Z0-9]{8,32}|[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12})$/i.test(cardId)) {
      return Response.json({ message: "Enter a valid membership card ID." }, { status: 400 });
    }
    if (!amountPattern.test(amountValue)) {
      return Response.json(
        { message: "Enter a valid amount with up to two decimal places." },
        { status: 400 }
      );
    }
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
      return Response.json({ message: "Enter a top-up amount greater than zero." }, { status: 400 });
    }
    if (reference.length < 3 || reference.length > 100) {
      return Response.json({ message: "Enter a valid payment reference number." }, { status: 400 });
    }
    if (!allowedProofTypes.has(proof.type) || proof.size > maxProofSize) {
      return Response.json(
        { message: "Upload a JPG, PNG, or WebP receipt no larger than 5 MB." },
        { status: 400 }
      );
    }

    supabase = createSupabaseServiceClient();

    const paymentId = crypto.randomUUID();
    const extension =
      proof.type === "image/jpeg" ? "jpg" : proof.type === "image/png" ? "png" : "webp";
    proofPath = `${paymentId}/receipt.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(proofPath, proof, { contentType: proof.type, upsert: false });
    if (uploadError) {
      console.error("Top-up receipt upload failed:", uploadError);
      return Response.json(
        { message: "The receipt could not be saved. Please try again." },
        { status: 502 }
      );
    }

    const { data: topupResult, error: topupError } = await supabase.rpc("submit_topup", {
      p_card_id: cardId,
      p_amount: amount,
      p_payment_method: "Online",
      p_proof_path: proofPath,
    });

    if (topupError) {
      console.error("Top-up RPC execution failed:", topupError);
      if (topupError.message.includes("CARD_NOT_FOUND")) {
        return Response.json({ message: "Active membership card not found." }, { status: 404 });
      }
      return Response.json(
        { message: "Your top-up could not be processed. Please try again." },
        { status: 500 }
      );
    }

    const orderReference = topupResult?.order_reference || `TOP-${paymentId.slice(0, 8).toUpperCase()}`;
    proofPath = undefined;
    return Response.json({ orderReference, status: "pending" }, { status: 201 });
  } catch (error) {
    console.error("Top-up request failed:", error);
    if (proofPath && supabase) {
      const { error: cleanupError } = await supabase.storage
        .from("payment-proofs")
        .remove([proofPath]);
      if (cleanupError) console.error("Orphaned top-up receipt cleanup failed:", cleanupError);
    }
    return Response.json(
      { message: "Top-up is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
