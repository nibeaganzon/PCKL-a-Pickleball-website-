import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type InventoryInput = {
  kind: "court" | "equipment";
  name: string;
  description: string;
  price: number;
  quantity?: number;
  courtType?: "Indoor" | "Outdoor";
  status?: "Available" | "Maintenance";
  image: string;
};

export function parseInventoryInputForRoute(
  value: unknown
): InventoryInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    (input.kind !== "court" && input.kind !== "equipment") ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 100 ||
    typeof input.description !== "string" ||
    input.description.length > 1000 ||
    typeof input.price !== "number" ||
    !Number.isFinite(input.price) ||
    input.price <= 0 ||
    typeof input.image !== "string" ||
    input.image.length > 2048
  ) {
    return null;
  }

  if (input.kind === "court") {
    if (
      (input.courtType !== "Indoor" && input.courtType !== "Outdoor") ||
      !["Available", "Maintenance"].includes(String(input.status))
    ) {
      return null;
    }
    return {
      kind: "court",
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      courtType: input.courtType,
      status: input.status as InventoryInput["status"],
      image: input.image.trim(),
    };
  }

  if (
    typeof input.quantity !== "number" ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 0 ||
    input.quantity > 10000
  ) {
    return null;
  }

  return {
    kind: "equipment",
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    quantity: input.quantity,
    image: input.image.trim(),
  };
}

export async function inventoryNameIsUnique(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  table: "courts" | "equipments",
  name: string,
  excludeId?: string
) {
  let query = supabase
    .from(table)
    .select("id")
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"));
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return !data?.length;
}
