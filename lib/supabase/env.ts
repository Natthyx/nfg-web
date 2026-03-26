/**
 * Resolve Supabase URL and anon/publishable key from env.
 * Supports legacy JWT anon key, new sb_publishable_* keys, and common Vercel var names.
 */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    ""
  );
}

/**
 * Shared cookie options for Supabase SSR auth.
 * Simplified approach to avoid cookie domain issues with custom domains.
 */
export function getSupabaseCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  // For custom domains, don't set explicit domain to avoid browser security issues
  // Let browser handle cookie domain automatically
  const base: Record<string, unknown> = {
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
    // No explicit domain - let browser set it correctly
  };

  return base as any;
}
