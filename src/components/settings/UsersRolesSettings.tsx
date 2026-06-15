import { inviteAppUser, updateAppUserMinister, updateAppUserRole } from "@/lib/actions";
import { fullName } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";
import type { Minister } from "@/types";

interface UsersRolesSettingsProps {
  users: AppUserSettingsRow[];
  ministers: Minister[];
}

export interface AppUserSettingsRow {
  id: string;
  email: string;
  role: AppRole;
  minister_id: string | null;
  created_at: string;
  minister: Pick<Minister, "id" | "first_name" | "last_name" | "email"> | null;
}

const ROLE_OPTIONS: AppRole[] = ["ADMIN", "SCHEDULER", "MINISTER"];

export function UsersRolesSettings({ users, ministers }: UsersRolesSettingsProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Users & Roles</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Invite app users, assign access roles, and link ministers to self-service accounts.
        </p>
      </div>

      <form action={inviteAppUser} className="rounded-lg border border-slate-200 bg-white p-4">
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
            <MinisterSelect ministers={ministers} name="minister_id" />
          </label>

          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
          >
            Invite
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">User</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Linked Minister</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  No app users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">Created {user.created_at.slice(0, 10)}</p>
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
                          <option key={role} value={role}>{role}</option>
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
                      <MinisterSelect ministers={ministers} name="minister_id" defaultValue={user.minister_id ?? ""} />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        Link
                      </button>
                    </form>
                    {user.minister && (
                      <p className="mt-1 text-xs text-slate-400">
                        Current: {fullName(user.minister)}
                      </p>
                    )}
                  </td>
                </tr>
              ))
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
