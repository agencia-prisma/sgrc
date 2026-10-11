import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./src/lib/supabase/database.types";
import { getSupabaseConfig } from "./src/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.error("Supabase session validation failed in proxy.", {
      name: error.name,
      code: "code" in error ? error.code : undefined,
      status: "status" in error ? error.status : undefined,
    });
    return new NextResponse("Não foi possível validar a sessão com o Supabase.", {
      status: 503,
    });
  }

  const isAuthenticated = Boolean(data?.claims);
  const isPublicAuthPage = [
    "/login",
    "/forgot-password",
    "/auth/callback",
  ].includes(request.nextUrl.pathname);

  if (!isPublicAuthPage && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
