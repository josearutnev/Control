import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

function redirectTo(request: NextRequest, pathname: string, source?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = pathname === "/preparar" ? url.search : "";
  const response = NextResponse.redirect(url);
  source?.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const { url, key } = supabaseEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const schemaProbe = await supabase.from("household_members").select("id").limit(1);
  const schemaMissing =
    schemaProbe.error?.code === "PGRST205" ||
    /schema cache|does not exist|could not find the table/i.test(schemaProbe.error?.message ?? "");

  if (schemaMissing) {
    if (path === "/preparar" || path === "/schema" || path.startsWith("/auth")) return supabaseResponse;
    const urlWithReason = request.nextUrl.clone();
    urlWithReason.pathname = "/preparar";
    urlWithReason.searchParams.set("motivo", "sql");
    const response = NextResponse.redirect(urlWithReason);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  let member = false;
  if (user) {
    const { data } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    member = Boolean(data);
  }

  const isAuthScreen = path === "/entrar" || path === "/registro";
  const isWelcome = path === "/bienvenida";

  if (path === "/preparar") {
    return redirectTo(request, user ? (member ? "/inicio" : "/bienvenida") : "/entrar", supabaseResponse);
  }

  if (!user && !isAuthScreen && !path.startsWith("/auth")) {
    return redirectTo(request, "/entrar", supabaseResponse);
  }

  if (user && isAuthScreen) {
    return redirectTo(request, member ? "/inicio" : "/bienvenida", supabaseResponse);
  }

  if (user && !member && !isWelcome && !path.startsWith("/auth")) {
    return redirectTo(request, "/bienvenida", supabaseResponse);
  }

  if (user && member && (isWelcome || path === "/")) {
    return redirectTo(request, "/inicio", supabaseResponse);
  }

  if (!user && path === "/") {
    return redirectTo(request, "/entrar", supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
