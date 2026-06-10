import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-navy-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Page not found</h1>
      <p className="text-slate-500 mb-6 max-w-sm">
        This page doesn't exist. If you were looking for a specific date or Mass,
        try navigating from the calendar.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
      >
        Back to Calendar
      </Link>
    </div>
  );
}
