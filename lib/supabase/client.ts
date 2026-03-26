import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
} from "@/lib/supabase/env";

export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Avoid parsing non-existent OAuth/PKCE fragments on full reload
      detectSessionInUrl: false,
      // Enable debug mode to track session issues
      debug: process.env.NODE_ENV === "development",
    },
    cookieOptions: getSupabaseCookieOptions(),
    // Add global configuration for better error handling
    global: {
      headers: {
        'X-Client-Info': 'nfg-web/1.0.0',
      },
    },
  });
}
