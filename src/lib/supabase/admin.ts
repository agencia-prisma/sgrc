import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

export function hasSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return Boolean(
    !(
      process.env.VERCEL === "1" &&
      process.env.VERCEL_ENV !== "production"
    ) &&
      serviceRoleKey &&
      serviceRoleKey !== "replace-with-your-server-only-service-role-key",
  );
}

export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseServiceRoleKey() || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
