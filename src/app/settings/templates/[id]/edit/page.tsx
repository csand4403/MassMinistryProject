import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/queries";
import { TemplateForm } from "@/components/settings/TemplateForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const template = await getTemplate(supabase, id);

  if (!template) notFound();

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
        <h1 className="text-xl font-bold text-slate-900">Edit Template</h1>
      </div>

      <TemplateForm template={template} />
    </div>
  );
}
