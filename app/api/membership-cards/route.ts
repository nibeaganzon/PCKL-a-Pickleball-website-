import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid registration details." }, { status: 400 });
  }

  const name =
    body && typeof body === "object" && "name" in body && typeof body.name === "string"
      ? body.name.trim()
      : "";
  const email =
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  if (name.length < 2 || name.length > 100) {
    return Response.json({ message: "Enter a valid name." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const cardId = `PCKL-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("membership_cards").insert({
      card_id: cardId,
      cardholder_name: name,
      cardholder_email: email,
    });

    if (error) throw error;
    return Response.json({ cardId, balance: 0 }, { status: 201 });
  } catch (error) {
    console.error("Membership card creation failed:", error);
    return Response.json(
      { message: "Your membership card could not be created. Please try again." },
      { status: 500 }
    );
  }
}
