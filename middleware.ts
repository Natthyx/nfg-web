import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add any code between createServerClient and
  // supabase.auth.getUser(). This call refreshes the session if the
  // access-token has expired, and writes updated cookies via setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isApiRoute = path.startsWith("/api/");

  // Allow API routes through
  if (isApiRoute) return supabaseResponse;

  // --- helper: build a redirect that KEEPS the refreshed auth cookies ------
  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    const redirectResponse = NextResponse.redirect(url);

    // Copy every cookie that the Supabase SDK just set on the
    // supabaseResponse so the browser receives the refreshed tokens.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    });

    return redirectResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isLoginPage) {
    return redirectWithCookies("/login");
  }

  // Redirect authenticated users away from login
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
