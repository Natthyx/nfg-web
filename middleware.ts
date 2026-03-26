import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
} from "@/lib/supabase/env";
import { NextResponse, type NextRequest } from "next/server";

function missingEnvResponse() {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Configuration required</title></head>
<body style="font-family:system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.25rem">Supabase environment variables are missing</h1>
<p>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and a client key (<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> or
<code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>) in Vercel → Environment Variables, then redeploy.</p>
</body></html>`,
    {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    }
  );
}

/**
 * Resolve the signed-in user for routing. Enhanced for custom domain session persistence.
 * First tries getUser() for validated JWT, falls back to getSession() for refresh scenarios.
 */
async function getAuthUser(supabase: SupabaseClient): Promise<User | null> {
  try {
    // Primary: Get validated user
    const {
      data: { user: fromUser },
    } = await supabase.auth.getUser();

    if (fromUser) return fromUser;

    // Fallback: Check session (handles token refresh)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) return session.user;

    // Final attempt: Force refresh if tokens exist but are stale
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.refreshSession();
    
    return refreshedUser || null;
  } catch (error) {
    console.warn('Auth check failed:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return missingEnvResponse();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Avoid parsing/clearing session based on URL fragments on full reloads.
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // `request.cookies.set` in middleware only supports (name, value).
        // The important part for auth is writing the cookie options to the response.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
    cookieOptions: getSupabaseCookieOptions(),
  });

  const user = await getAuthUser(supabase);

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isApiRoute = path.startsWith("/api/");

  if (isApiRoute) return supabaseResponse;

  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    const redirectResponse = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      const { name, value, ...opts } = cookie;
      redirectResponse.cookies.set(name, value, opts);
    });

    return redirectResponse;
  }

  if (!user && !isLoginPage) {
    return redirectWithCookies("/login");
  }

  if (user && isLoginPage) {
    return redirectWithCookies("/dashboard");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
