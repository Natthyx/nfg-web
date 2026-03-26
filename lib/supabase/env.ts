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
 * CRITICAL: Configure for custom domain nfg-admin.company
 */
export function getSupabaseCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  // CRITICAL: For custom domains, set explicit domain
  const base: Record<string, unknown> = {
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
    // CRITICAL: Set domain for custom domain
    domain: isProduction ? "nfg-admin.company" : undefined,
  };

  return base as any;
}
