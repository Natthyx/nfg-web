import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  // @supabase/ssr@0.8 forces: flowType "pkce", persistSession true,
  // detectSessionInUrl isBrowser(), autoRefreshToken isBrowser().
  // Passing auth overrides here has no effect — the library ignores them.
  return createBrowserClient(url, key);
}
