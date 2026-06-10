import Link from "next/link";
import { TemplateForm } from "@/components/settings/TemplateForm";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Settings
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">New Mass Template</h1>
      </div>

      <TemplateForm />
    </div>
  );
}
