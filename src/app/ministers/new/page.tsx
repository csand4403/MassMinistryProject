import Link from "next/link";
import { MinisterForm } from "@/components/ministers/MinisterForm";

export default function NewMinisterPage() {
  return (
    <div>
      <Link
        href="/ministers"
        className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-800 transition-colors mb-4"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Ministers
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 mb-6">Add New Minister</h1>

      <div className="parish-card p-6">
        <MinisterForm />
      </div>
    </div>
  );
}
