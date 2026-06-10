"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createMinister, updateMinister } from "@/lib/actions";
import { ROLE_LABELS, ROLE_DISPLAY_ORDER, PRIEST_TYPE_LABELS } from "@/types";
import type { Minister, MinisterRole, PriestType } from "@/types";

const ALL_ROLES: MinisterRole[] = ROLE_DISPLAY_ORDER;

const PRIEST_TYPE_OPTIONS: PriestType[] = [
  "PASTOR_ON_STAFF",
  "ASSOCIATE_ON_STAFF",
  "VISITING_CELEBRANT",
];

interface MinisterFormProps {
  minister?: Minister;
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

  // Priest-specific fields
  const [priestType, setPriestType] = useState<PriestType | "">(
    minister?.priest_type ?? ""
  );
  const [diocese, setDiocese] = useState(
    minister?.minister_diocese ?? "Diocese of Dallas"
  );
  const [letterOnFile, setLetterOnFile] = useState(
    minister?.letter_of_suitability ?? false
  );
  const [letterExpiry, setLetterExpiry] = useState(
    minister?.letter_expiration_date ?? ""
  );

  const isCelebrant = selectedRoles.includes("CELEBRANT");
  const isDallaDiocese = diocese.trim() === "Diocese of Dallas" || diocese.trim() === "";

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
      const priestFields = isCelebrant && priestType
        ? {
            priest_type: priestType as PriestType,
            minister_diocese: diocese.trim() || "Diocese of Dallas",
            letter_of_suitability: letterOnFile,
            letter_expiration_date: (!isDallaDiocese && letterExpiry) ? letterExpiry : undefined,
          }
        : {
            priest_type: undefined as PriestType | undefined,
            minister_diocese: undefined as string | undefined,
            letter_of_suitability: false,
            letter_expiration_date: undefined as string | undefined,
          };

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
          ...priestFields,
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
          ...priestFields,
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

      {/* Priest-specific fields — shown only when CELEBRANT role selected */}
      {isCelebrant && (
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-sky-800">Priest Details</h3>

          <Field label="Priest Type">
            <select
              value={priestType}
              onChange={(e) => setPriestType(e.target.value as PriestType | "")}
              className={inputClass}
            >
              <option value="">— Select type —</option>
              {PRIEST_TYPE_OPTIONS.map((pt) => (
                <option key={pt} value={pt}>{PRIEST_TYPE_LABELS[pt]}</option>
              ))}
            </select>
          </Field>

          <Field label="Diocese">
            <input
              type="text"
              value={diocese}
              onChange={(e) => setDiocese(e.target.value)}
              placeholder="Diocese of Dallas"
              className={inputClass}
            />
          </Field>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={letterOnFile}
              onClick={() => setLetterOnFile((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-600",
                letterOnFile ? "bg-green-600" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  letterOnFile ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm text-slate-600">
              Letter of Suitability on file
            </span>
          </div>

          {/* Expiry date — only relevant for non-Dallas-diocese visiting celebrants */}
          {priestType === "VISITING_CELEBRANT" && !isDallaDiocese && (
            <Field label="Letter Expiration Date">
              <input
                type="date"
                value={letterExpiry}
                onChange={(e) => setLetterExpiry(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      )}

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
