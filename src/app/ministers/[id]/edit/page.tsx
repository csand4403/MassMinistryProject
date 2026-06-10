import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMinister } from "@/lib/queries";
import { MinisterForm } from "@/components/ministers/MinisterForm";
import { fullName } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMinisterPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const minister = await getMinister(supabase, id);
  if (!minister) notFound();

  return (
    <div>
      <Link
        href={`/ministers/${id}`}
        className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-800 transition-colors mb-4"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to {fullName(minister)}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 mb-6">
        Edit Minister — {fullName(minister)}
      </h1>

      <div className="parish-card p-6">
        <MinisterForm minister={minister} />
      </div>
    </div>
  );
}
