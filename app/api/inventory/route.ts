import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const [courtsResult, equipmentResult, reservationsResult] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name, description, type, is_active, price, images")
        .order("name"),
      supabase
        .from("equipments")
        .select("id, name, description, quantity, price, images")
        .order("name"),
      supabase
        .from("court_reservations")
        .select("court_id, start_date, end_date, status")
        .eq("status", "Active"),
    ]);

    if (courtsResult.error) throw courtsResult.error;
    if (equipmentResult.error) throw equipmentResult.error;

    const now = Date.now();
    const bookedCourtIds = new Set(
      (reservationsResult.data ?? [])
        .filter((r) => {
          const start = new Date(r.start_date).getTime();
          const end = new Date(r.end_date).getTime();
          return now >= start && now <= end;
        })
        .map((r) => r.court_id)
    );

    return Response.json(
      {
        courts: (courtsResult.data ?? []).map((court) => {
          const isBooked = bookedCourtIds.has(court.id);
          const status = !court.is_active
            ? "Maintenance"
            : isBooked
              ? "Booked"
              : "Available";
          return {
            kind: "court",
            id: court.id,
            name: court.name,
            description: court.description ?? "",
            courtType: court.type ?? "Outdoor",
            status,
            price: Number(court.price),
            image: court.images?.[0] ?? "",
          };
        }),
        equipment: (equipmentResult.data ?? []).map((item) => ({
          kind: "equipment",
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: Number(item.price),
          quantity: Number(item.quantity),
          image: item.images?.[0] ?? "",
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Inventory could not be loaded:", error);
    return Response.json(
      { message: "Inventory could not be loaded." },
      { status: 500 }
    );
  }
}
