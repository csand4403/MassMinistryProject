"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createMinister, updateMinister } from "@/lib/actions";
import { ROLE_LABELS } from "@/types";
import type { Minister, MinisterRole } from "@/types";

const ALL_ROLES: MinisterRole[] = [
  "CELEBRANT", "DEACON", "LECTOR",
  "PSALMIST", "EMHC", "USHER", "SECURITY",
];

interface MinisterFormProps {
  minister?: Minister; // undefined = create mode
}

export function MinisterForm({ minister }: MinisterFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(minister?.first_name ?? "");
  const [lastName, setLastName] = useState(minister?.last_name ?? "");
  const [email, setEmail] = useState(minister?.email ?? "");
  const [phone, setPhone] = useState(minister?.phone ?? "");
  const [notifPref, setNotifPref] = useState<Minister["notification_preference"]>(
    minister?.notification_preference ?? "email"
  );
  const [selectedRoles, setSelectedRoles] = useState<MinisterRole[]>(
    minister?.roles ?? []
  );
  const [notes, setNotes] = useState(minister?.notes ?? "");
  const [isActive, setIsActive] = useState(minister?.is_active ?? true);

  const toggleRole = (role: MinisterRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (selectedRoles.length === 0) {
      setError("Please select at least one role.");
      return;
    }

    startTransition(async () => {
      if (minister) {
        const result = await updateMinister(minister.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notification_preference: notifPref,
          roles: selectedRoles,
          notes: notes.trim() || undefined,
          is_active: isActive,
        });
        if (!result.success) {
          setError(result.error ?? "Failed to update minister");
          return;
        }
        router.push(`/ministers/${minister.id}`);
      } else {
        const result = await createMinister({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notification_preference: notifPref,
          roles: selectedRoles,
          notes: notes.trim() || undefined,
        });
        if (!result.success) {
          setError(result.error ?? "Failed to create minister");
          return;
        }
        router.push("/ministers");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Name */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" required>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Thomas"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Last Name" required>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Burke"
            className={inputClass}
            required
          />
        </Field>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="minister@example.com"
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="312-555-0100"
            className={inputClass}
          />
        </Field>
      </div>

      {/* Notification preference */}
      <Field label="Notification Preference">
        <select
          value={notifPref}
          onChange={(e) => setNotifPref(e.target.value as any)}
          className={inputClass}
        >
          <option value="email">Email only</option>
          <option value="sms">SMS only</option>
          <option value="both">Email + SMS</option>
          <option value="none">None</option>
        </select>
      </Field>

      {/* Roles */}
      <Field label="Qualified Roles" required>
        <p className="text-xs text-slate-400 mb-2">
          Select all roles this minister is trained and qualified to serve.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => {
            const selected = selectedRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ring-1",
                  selected
                    ? "bg-navy-700 text-white ring-navy-700"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {ROLE_LABELS[role]}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about availability, preferences, etc."
          className={cn(inputClass, "resize-none")}
        />
      </Field>

      {/* Active toggle (edit mode only) */}
      {minister && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-600",
              isActive ? "bg-navy-700" : "bg-slate-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                isActive ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm text-slate-600">
            {isActive ? "Active minister" : "Inactive (will not appear in assignment lists)"}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "rounded-lg bg-navy-800 px-5 py-2 text-sm font-semibold text-white",
            "hover:bg-navy-700 transition-colors focus-ring",
            isPending && "opacity-60 cursor-not-allowed"
          )}
        >
          {isPending
            ? "Saving…"
            : minister
            ? "Save Changes"
            : "Add Minister"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
