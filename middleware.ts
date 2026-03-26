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

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Avoid parsing/clearing session based on URL fragments on full reloads.
      detectSessionInUrl: false,
      // Ensure flow is not interrupted on refresh
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    cookieOptions: getSupabaseCookieOptions(),
  });

  // Refresh session on every request to ensure client-server sync
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const user = session?.user;

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isApiRoute = path.startsWith("/api/");

  if (isApiRoute) return response;

  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    const redirectResponse = NextResponse.redirect(url);

    // Preserve all cookies from the response
    response.cookies.getAll().forEach((cookie) => {
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

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes that don't need auth
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
