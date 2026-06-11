import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Minister } from "@/types";

export type AppRole = "ADMIN" | "SCHEDULER" | "MINISTER";

export interface AppUser {
  id: string;
  parish_id: string;
  minister_id: string | null;
  role: AppRole;
  created_at: string;
  minister?: Minister | null;
}

export const ADMIN_PATHS = ["/reports"] as const;
export const SCHEDULER_ALLOWED_SETTINGS = new Set(["templates", "ministers"]);

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("app_user")
    .select("*, minister(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AppUser;
}

export async function requireAppUser(): Promise<AppUser> {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  return appUser;
}

export async function requireRole(allowedRoles: AppRole[]): Promise<AppUser> {
  const appUser = await requireAppUser();
  if (!allowedRoles.includes(appUser.role)) {
    redirect(appUser.role === "MINISTER" ? "/my-schedule" : "/");
  }
  return appUser;
}

export function defaultPathForRole(role: AppRole) {
  return role === "MINISTER" ? "/my-schedule" : "/";
}
