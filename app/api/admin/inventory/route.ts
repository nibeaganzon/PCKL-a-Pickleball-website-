import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  inventoryNameIsUnique,
  parseInventoryInputForRoute,
} from "./shared";

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();
    const [courtsResult, equipmentResult] = await Promise.all([
      supabase.from("courts").select("*").order("name"),
      supabase.from("equipments").select("*").order("name"),
    ]);
    if (courtsResult.error) throw courtsResult.error;
    if (equipmentResult.error) throw equipmentResult.error;

    return Response.json(
      {
        courts: (courtsResult.data ?? []).map((court) => ({
          kind: "court",
          id: court.id,
          name: court.name,
          description: court.description ?? "",
          courtType: court.court_type ?? court.type ?? "Outdoor",
          status: court.status ?? (court.is_active !== false ? "Available" : "Maintenance"),
          price: Number(court.price),
          image: court.images?.[0] ?? "",
        })),
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
    console.error("Admin inventory could not be loaded:", error);
    return Response.json(
      { message: "Inventory could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid request body." }, { status: 400 });
    }
    const input = parseInventoryInputForRoute(body);
    if (!input) {
      return Response.json({ message: "Enter valid inventory details." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const table = input.kind === "court" ? "courts" : "equipments";
    if (!(await inventoryNameIsUnique(supabase, table, input.name))) {
      return Response.json(
        { message: "An inventory item with that name already exists." },
        { status: 409 }
      );
    }

    let itemId: string;
    if (input.kind === "court") {
      const { data, error } = await supabase
        .from("courts")
        .insert({
          name: input.name,
          description: input.description,
          type: input.courtType,
          is_active: input.status !== "Maintenance",
          price: input.price,
          images: input.image ? [input.image] : [],
        })
        .select("id")
        .single();
      if (error) throw error;
      itemId = data.id;
    } else {
      const { data, error } = await supabase
        .from("equipments")
        .insert({
          name: input.name,
          description: input.description,
          quantity: input.quantity,
          price: input.price,
          images: input.image ? [input.image] : [],
        })
        .select("id")
        .single();
      if (error) throw error;
      itemId = data.id;
    }

    return Response.json(
      { message: `${input.kind === "court" ? "Court" : "Equipment"} added.`, id: itemId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Inventory item could not be created:", error);
    return Response.json(
      { message: "The inventory item could not be created." },
      { status: 500 }
    );
  }
}
