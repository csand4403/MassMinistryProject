import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTemplates } from "@/lib/queries";
import { TemplateList } from "@/components/settings/TemplateList";

export const revalidate = 0;

export default async function SettingsPage() {
  const supabase = await createClient();
  const templates = await getTemplates(supabase);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage parish-wide configuration for Mass Ministry scheduling.
        </p>
      </div>

      {/* Mass Templates section */}
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
    </div>
  );
}
