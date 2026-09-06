import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login"]);
const SCHEDULER_ALLOWED_SETTINGS = new Set(["templates", "ministers"]);

type AppRole = "ADMIN" | "SCHEDULER" | "MINISTER";

/**
 * GAMEDAY_ONLY turns a deployment into the football app and nothing else:
 * "/" redirects to /gameday and every parish route 404s.
 *
 * This exists so the dashboard can be given a PUBLIC url and shared without
 * also publishing the parish scheduling app that shares this deployment.
 * Set GAMEDAY_ONLY=1 on any host serving the football tool to outsiders.
 */
const GAMEDAY_ONLY = process.env.GAMEDAY_ONLY === "1";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (GAMEDAY_ONLY) {
    // The matcher below already excludes /gameday and /api/gameday, so
    // anything reaching here is a parish route.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/gameday", request.url));
    }
    return new NextResponse("Not found", { status: 404 });
  }

  if (PUBLIC_PATHS.has(pathname)) {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return response;

    const appUser = await getAppUserRole(supabase, user.id);
    if (!appUser || !appUser.is_active) return response;

    return NextResponse.redirect(new URL(defaultPathForRole(appUser.role), request.url));
  }

  const response = NextResponse.next();
  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const appUser = await getAppUserRole(supabase, user.id);
  if (!appUser) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("provisioned", "missing");
    return NextResponse.redirect(loginUrl);
  }

  if (!appUser.is_active) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("inactive", "true");
    return NextResponse.redirect(loginUrl);
  }

  if (appUser.role === "MINISTER" && pathname !== "/my-schedule") {
    return NextResponse.redirect(new URL("/my-schedule", request.url));
  }

  if (appUser.role === "SCHEDULER") {
    if (pathname.startsWith("/reports") || pathname.startsWith("/ministers")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname === "/settings") {
      const section = searchParams.get("section") ?? "templates";
      if (!SCHEDULER_ALLOWED_SETTINGS.has(section)) {
        return NextResponse.redirect(new URL("/settings", request.url));
      }
    }
  }

  return response;
}

function defaultPathForRole(role: AppRole) {
  return role === "MINISTER" ? "/my-schedule" : "/";
}

function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
}

async function getAppUserRole(
  supabase: ReturnType<typeof createMiddlewareClient>,
  userId: string
): Promise<{ role: AppRole; is_active: boolean } | null> {
  const { data, error } = await supabase
    .from("app_user")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as { role: AppRole; is_active: boolean };
}

export const config = {
  matcher: [
    // `gameday` and `api/gameday` are the "Get Over There Now" football tool,
    // which is a single-user personal utility with no accounts by design and
    // must not be pushed through the parish login flow.
    "/((?!_next/static|_next/image|favicon.ico|MIC.png|api/send-reminders|api/assignments/respond|gameday|api/gameday).*)",
  ],
};
