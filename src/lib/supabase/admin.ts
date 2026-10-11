import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig, getSupabaseServiceRoleKey } from "./config";

export function createAdminClient() {
  const { url } = getSupabaseConfig();

  return createSupabaseClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
