"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <p className="text-5xl mb-4" aria-hidden="true">⚠️</p>
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Something went wrong</h1>
      <p className="text-slate-500 mb-2 max-w-sm text-sm">
        {error.message || "An unexpected error occurred loading this page."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 mb-6 font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
