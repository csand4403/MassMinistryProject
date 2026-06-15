import { inviteAppUser, updateAppUserAccess, updateAppUserMinister, updateAppUserRole } from "@/lib/actions";
import { fullName } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";
import type { Minister, Parish } from "@/types";

interface UsersRolesSettingsProps {
  users: AppUserSettingsRow[];
  ministers: Minister[];
  successMessage?: string;
  errorMessage?: string;
}

export interface AppUserSettingsRow {
  id: string;
  email: string;
  role: AppRole;
  minister_id: string | null;
  parish_id: string;
  is_active: boolean;
  created_at: string;
  parish: Pick<Parish, "id" | "name"> | null;
  minister: Pick<Minister, "id" | "first_name" | "last_name" | "email" | "is_active"> | null;
}

const ROLE_OPTIONS: AppRole[] = ["ADMIN", "SCHEDULER", "MINISTER"];

export function UsersRolesSettings({ users, ministers, successMessage, errorMessage }: UsersRolesSettingsProps) {
  const linkedMinisterIds = new Set(users.map((user) => user.minister_id).filter(Boolean));
  const unlinkedMinisters = ministers.filter((minister) => !linkedMinisterIds.has(minister.id));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Users & Roles</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Invite app users, assign access roles, and link ministers to self-service accounts.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="parish-card p-4">
        <h3 className="text-sm font-semibold text-slate-800">Invite or link an auth user</h3>
        <p className="mt-1 text-sm text-slate-500">
          Create the user in Supabase Auth, then add/link them here. If invite email is configured,
          this form can also send the Supabase invite and create the app access row.
        </p>
      </div>

      <form action={inviteAppUser} className="parish-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_150px_1fr_auto] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-navy-200 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
            <select
              name="role"
              defaultValue="MINISTER"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-navy-200 focus:ring-2"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minister Link</span>
            <MinisterSelect ministers={unlinkedMinisters} name="minister_id" />
          </label>

          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
          >
            Add user
          </button>
        </div>
      </form>

      <div className="parish-card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">User</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Linked Minister</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Parish</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="font-medium text-slate-700">No app users found.</p>
                  <p className="mt-1 text-sm text-slate-400">Add a Supabase Auth user above to start managing access.</p>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const ministerOptions = ministers.filter(
                  (minister) => minister.id === user.minister_id || !linkedMinisterIds.has(minister.id)
                );

                return (
                  <tr key={user.id} className={user.is_active ? "align-top" : "align-top bg-slate-50/70"}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">Created {formatDate(user.created_at)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <form action={updateAppUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none ring-navy-200 focus:ring-2"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{roleLabel(role)}</option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-4">
                      <form action={updateAppUserMinister} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={user.id} />
                        <MinisterSelect ministers={ministerOptions} name="minister_id" defaultValue={user.minister_id ?? ""} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          Save
                        </button>
                      </form>
                      {user.minister ? (
                        <p className="mt-1 text-xs text-slate-400">
                          Current: {fullName(user.minister)}
                          {!user.minister.is_active ? " (inactive minister record)" : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">No minister linked.</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {user.parish?.name ?? "No parish"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.is_active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                        }`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                        <form action={updateAppUserAccess}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="is_active" value={user.is_active ? "false" : "true"} />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            {user.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MinisterSelect({
  ministers,
  name,
  defaultValue = "",
}: {
  ministers: Minister[];
  name: string;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="mt-1 w-full min-w-[210px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-navy-200 focus:ring-2"
    >
      <option value="">No linked minister</option>
      {ministers.map((minister) => (
        <option key={minister.id} value={minister.id}>
          {fullName(minister)}{minister.email ? ` - ${minister.email}` : ""}
        </option>
      ))}
    </select>
  );
}

function roleLabel(role: AppRole) {
  if (role === "ADMIN") return "Admin";
  if (role === "SCHEDULER") return "Scheduler";
  return "Minister";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
