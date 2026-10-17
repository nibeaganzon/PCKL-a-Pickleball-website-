import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseServiceClient } from "./supabase/service";

export async function requireAdmin() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { user: null, response: Response.json({ message: "Sign in required." }, { status: 401 }) };
  }

  const serviceClient = createSupabaseServiceClient();
  const { data: admin, error } = await serviceClient
    .from("admin_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!admin) {
    return {
      user: null,
      response: Response.json({ message: "Admin access required." }, { status: 403 }),
    };
  }

  return { user, response: null };
}
