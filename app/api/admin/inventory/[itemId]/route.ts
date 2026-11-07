import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  inventoryNameIsUnique,
  parseInventoryInputForRoute,
} from "../shared";

function isValidId(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;
    const { itemId } = await context.params;
    if (!isValidId(itemId)) {
      return Response.json({ message: "Invalid inventory ID." }, { status: 400 });
    }

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
    const { data: current, error: currentError } = await supabase
      .from(table)
      .select("id")
      .eq("id", itemId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return Response.json({ message: "Inventory item not found." }, { status: 404 });
    }

    if (!(await inventoryNameIsUnique(supabase, table, input.name, itemId))) {
      return Response.json(
        { message: "An inventory item with that name already exists." },
        { status: 409 }
      );
    }

    const values =
      input.kind === "court"
        ? {
            name: input.name,
            description: input.description,
            type: input.courtType,
            is_active: input.status !== "Maintenance",
            price: input.price,
            images: input.image ? [input.image] : [],
          }
        : {
            name: input.name,
            description: input.description,
            quantity: input.quantity,
            price: input.price,
            images: input.image ? [input.image] : [],
          };
    const { error } = await supabase.from(table).update(values).eq("id", itemId);
    if (error) throw error;

    return Response.json({ message: "Inventory item updated." });
  } catch (error) {
    console.error("Inventory item could not be updated:", error);
    return Response.json(
      { message: "The inventory item could not be updated." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;
    const { itemId } = await context.params;
    if (!isValidId(itemId)) {
      return Response.json({ message: "Invalid inventory ID." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid request body." }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== "object" ||
      ((body as Record<string, unknown>).kind !== "court" &&
        (body as Record<string, unknown>).kind !== "equipment")
    ) {
      return Response.json({ message: "Choose a valid inventory type." }, { status: 400 });
    }

    const kind = (body as { kind: "court" | "equipment" }).kind;
    const supabase = createSupabaseServiceClient();
    const table = kind === "court" ? "courts" : "equipments";

    const { data: itemData } = await supabase
      .from(table)
      .select("images")
      .eq("id", itemId)
      .maybeSingle();

    const { error } = await supabase.from(table).delete().eq("id", itemId);
    if (error) {
      if (error.code === "23503") {
        return Response.json(
          { message: "This item has existing reservations or rentals and cannot be deleted." },
          { status: 409 }
        );
      }
      throw error;
    }

    if (itemData?.images && Array.isArray(itemData.images)) {
      const storagePrefix = "/storage/v1/object/public/inventory/";
      const pathsToDelete = itemData.images
        .filter((url: string) => typeof url === "string" && url.includes(storagePrefix))
        .map((url: string) => url.split(storagePrefix)[1])
        .filter(Boolean);

      if (pathsToDelete.length > 0) {
        await supabase.storage.from("inventory").remove(pathsToDelete);
      }
    }

    return Response.json({ message: "Inventory item deleted." });
  } catch (error) {
    console.error("Inventory item could not be deleted:", error);
    return Response.json(
      { message: "The inventory item could not be deleted." },
      { status: 500 }
    );
  }
}
