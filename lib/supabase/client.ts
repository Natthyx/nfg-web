import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  browserClient = createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  // CRITICAL: Immediately force auth initialization on creation to guarantee
  // any subsequent `supabase.from()` fetches are NEVER blocked, no matter 
  // which component created the client or how Next.js routes SPA navigation.
  browserClient.auth.getSession().catch(() => {});

  return browserClient;
}
