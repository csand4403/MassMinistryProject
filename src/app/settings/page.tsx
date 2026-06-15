import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMinisters, getTemplates } from "@/lib/queries";
import { TemplateList } from "@/components/settings/TemplateList";
import { UsersRolesSettings, type AppUserSettingsRow } from "@/components/settings/UsersRolesSettings";
import { MinisterImportFlow } from "@/components/ministers/MinisterImportFlow";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ section?: string; success?: string; error?: string }>;
}

const SETTINGS_SECTIONS = [
  { key: "templates", label: "Mass Templates" },
  { key: "ministers", label: "Ministers" },
  { key: "parish-profile", label: "Parish Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "users-roles", label: "Users & Roles" },
];

export default async function SettingsPage({ searchParams }: PageProps) {
  const appUser = await requireRole(["ADMIN", "SCHEDULER"]);
  const params = await searchParams;
  const visibleSections = appUser.role === "SCHEDULER"
    ? SETTINGS_SECTIONS.filter((section) => section.key === "templates" || section.key === "ministers")
    : SETTINGS_SECTIONS;
  const selectedSection = visibleSections.some((section) => section.key === params.section)
    ? params.section!
    : "templates";

  const supabase = await createClient();
  const [templates, ministers] = await Promise.all([
    getTemplates(supabase),
    getMinisters(supabase),
  ]);
  const appUsers = selectedSection === "users-roles" && appUser.role === "ADMIN"
    ? await getAppUsersForSettings()
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage parish-wide configuration for Mass Ministry scheduling.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <aside className="space-y-1">
          {visibleSections.map((section) => (
            <Link
              key={section.key}
              href={section.key === "templates" ? "/settings" : `/settings?section=${section.key}`}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                selectedSection === section.key
                  ? "bg-navy-800 text-white"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              )}
            >
              {section.label}
            </Link>
          ))}
        </aside>

        {selectedSection === "templates" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Mass Templates</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Reusable blueprints that define role requirements for recurring Mass times.
                  Link a template to a Mass to drive staffing status dots.
                </p>
              </div>
              <Link
                href="/settings/templates/new"
                className="flex items-center gap-1.5 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 transition-colors flex-shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Template
              </Link>
            </div>

            <TemplateList templates={templates} />
          </section>
        )}

        {selectedSection === "ministers" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Ministers</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Import many ministers at once from CSV or XLSX.
              </p>
            </div>
            <MinisterImportFlow ministers={ministers} />
          </section>
        )}

        {selectedSection === "parish-profile" && <ComingSoon title="Parish Profile" />}
        {selectedSection === "notifications" && <ComingSoon title="Notifications" />}
        {selectedSection === "users-roles" && (
          <UsersRolesSettings
            users={appUsers}
            ministers={ministers}
            successMessage={params.success}
            errorMessage={params.error}
          />
        )}
      </div>
    </div>
  );
}

async function getAppUsersForSettings(): Promise<AppUserSettingsRow[]> {
  const admin = createAdminClient();
  const [{ data: appUsers, error }, { data: authUsers, error: authError }] = await Promise.all([
    admin
      .from("app_user")
      .select("id, role, minister_id, parish_id, is_active, created_at, minister(id, first_name, last_name, email, is_active), parish(id, name)")
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (error) throw new Error(error.message);
  if (authError) throw new Error(authError.message);

  const emailById = new Map(authUsers.users.map((user) => [user.id, user.email ?? "(no email)"]));

  return (appUsers ?? []).map((user) => ({
    id: user.id,
    email: emailById.get(user.id) ?? "(auth user missing)",
    role: user.role,
    minister_id: user.minister_id,
    parish_id: user.parish_id,
    parish: user.parish,
    is_active: user.is_active,
    created_at: user.created_at,
    minister: user.minister,
  })) as unknown as AppUserSettingsRow[];
}

function ComingSoon({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </section>
  );
}
