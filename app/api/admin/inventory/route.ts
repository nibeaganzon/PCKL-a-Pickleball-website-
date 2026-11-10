import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  inventoryNameIsUnique,
  parseInventoryInputForRoute,
} from "./shared";

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
