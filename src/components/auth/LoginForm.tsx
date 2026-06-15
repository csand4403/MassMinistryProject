"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const provisioned = searchParams.get("provisioned") !== "missing";
  const inactive = searchParams.get("inactive") === "true";
  const redirectTo = searchParams.get("next") ?? "/";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "sign-up") {
      setMessage("Account created. Ask an admin to link it before signing in.");
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Mass Ministry access for Mary Immaculate.</p>
      </div>

      {!provisioned && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your login exists, but it has not been linked to an app role yet.
        </div>
      )}

      {inactive && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          This app account is inactive. Contact a parish administrator to restore access.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-navy-200 focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-navy-200 focus:ring-2"
          />
        </label>

        {message && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
        }}
        className="mt-4 w-full text-center text-sm font-medium text-navy-700 hover:text-navy-900"
      >
        {mode === "sign-in" ? "Create an account" : "Use an existing account"}
      </button>
    </div>
  );
}
