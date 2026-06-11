"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { bulkImportMinisters } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { ROLE_SHORT_LABELS, ROLE_DISPLAY_ORDER } from "@/types";
import type { Minister, MinisterRole } from "@/types";

type ImportStatus = "New" | "Possible Duplicate" | "Error";
type DuplicateDecision = "skip" | "add" | "merge";

interface ParsedRow {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  roles: MinisterRole[];
  notification_preference: "email" | "sms" | "both" | "none";
  notes?: string;
  status: ImportStatus;
  error?: string;
  duplicate?: Minister;
  decision: DuplicateDecision;
}

interface MinisterImportFlowProps {
  ministers: Minister[];
}

const HEADER_ALIASES: Record<string, string> = {
  "first name": "first_name",
  firstname: "first_name",
  first: "first_name",
  "last name": "last_name",
  lastname: "last_name",
  last: "last_name",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  roles: "roles",
  role: "roles",
  "notification preference": "notification_preference",
  notification: "notification_preference",
  preference: "notification_preference",
  notes: "notes",
  note: "notes",
};

const ROLE_ALIASES: Record<string, MinisterRole> = {
  priest: "CELEBRANT",
  celebrant: "CELEBRANT",
  deacon: "DEACON",
  lector: "LECTOR",
  psalmist: "PSALMIST",
  cantor: "PSALMIST",
  emhc: "EMHC",
  eucharisticminister: "EMHC",
  extraordinaryministerofholycommunion: "EMHC",
  extraordinaryminister: "EMHC",
  usher: "USHER",
  altarserver: "ALTAR_SERVER",
  server: "ALTAR_SERVER",
  security: "SECURITY",
  thurifer: "THURIFER",
};

export function MinisterImportFlow({ ministers }: MinisterImportFlowProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => ({
    newRows: rows.filter((row) => row.status === "New").length,
    duplicates: rows.filter((row) => row.status === "Possible Duplicate").length,
    errors: rows.filter((row) => row.status === "Error").length,
  }), [rows]);

  const handleFile = async (file: File) => {
    setParseError(null);
    setSummary(null);
    setCommitError(null);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = rawRows.map((raw, index) => parseRow(raw, index, ministers));
      setRows(parsed);
      if (parsed.length === 0) {
        setParseError("No rows were found in that file.");
      }
    } catch {
      setRows([]);
      setParseError("Unable to read that file. Please upload a valid CSV or XLSX file.");
    }
  };

  const setDecision = (id: string, decision: DuplicateDecision) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, decision } : row));
  };

  const handleCommit = () => {
    setCommitError(null);
    setSummary(null);

    const importable = rows.filter((row) => row.status !== "Error");
    startTransition(async () => {
      const result = await bulkImportMinisters(importable.map((row) => ({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        notification_preference: row.notification_preference,
        roles: row.roles,
        notes: row.notes,
        duplicate_id: row.duplicate?.id,
        decision: row.status === "Possible Duplicate" ? row.decision : "add",
      })));

      if (!result.success) {
        setCommitError(result.error ?? "Import failed.");
        return;
      }

      setSummary(`${result.added} new ministers added, ${result.merged} merged, ${result.skipped} skipped.`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Upload CSV or XLSX</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-navy-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-700"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
        {fileName && <p className="mt-3 text-xs text-slate-500">Selected: {fileName}</p>}
        {parseError && <p className="mt-3 text-sm font-medium text-red-700">{parseError}</p>}
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700 ring-1 ring-green-200">{counts.newRows} New</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-200">{counts.duplicates} Possible Duplicate</span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700 ring-1 ring-red-200">{counts.errors} Error</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Imported Row</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Roles</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duplicate Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={row.status === "Error" ? "bg-red-50/40" : undefined}>
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.first_name || "—"} {row.last_name || ""}</div>
                      {row.notes && <div className="mt-1 max-w-xs text-xs text-slate-500">{row.notes}</div>}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600">
                      <div>{row.email || "No email"}</div>
                      <div className="text-xs text-slate-500">{row.phone || "No phone"}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600">
                      {row.roles.length > 0 ? row.roles.map((role) => ROLE_SHORT_LABELS[role]).join(", ") : "No roles mapped"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        row.status === "New" && "bg-green-50 text-green-700",
                        row.status === "Possible Duplicate" && "bg-amber-50 text-amber-700",
                        row.status === "Error" && "bg-red-50 text-red-700"
                      )}>
                        {row.status}
                      </span>
                      {row.error && <p className="mt-1 text-xs text-red-700">{row.error}</p>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.status === "Possible Duplicate" && row.duplicate ? (
                        <div className="space-y-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            <DuplicatePanel title="Existing" minister={row.duplicate} />
                            <DuplicatePanel title="Imported" minister={rowToMinister(row)} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(["skip", "add", "merge"] as DuplicateDecision[]).map((decision) => (
                              <button
                                key={decision}
                                type="button"
                                onClick={() => setDecision(row.id, decision)}
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
                                  row.decision === decision
                                    ? "bg-navy-800 text-white ring-navy-800"
                                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                {decision === "skip" ? "Skip" : decision === "add" ? "Add as new" : "Merge"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Rows with errors are excluded from commit.</p>
            <button
              type="button"
              disabled={isPending || rows.every((row) => row.status === "Error")}
              onClick={handleCommit}
              className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPending ? "Importing..." : "Confirm Import"}
            </button>
          </div>
          {commitError && <p className="text-sm font-medium text-red-700">{commitError}</p>}
          {summary && <p className="text-sm font-semibold text-green-700">{summary}</p>}
        </div>
      )}
    </div>
  );
}

function parseRow(raw: Record<string, unknown>, index: number, ministers: Minister[]): ParsedRow {
  const normalized = normalizeHeaders(raw);
  const firstName = cell(normalized.first_name);
  const lastName = cell(normalized.last_name);
  const email = cell(normalized.email).toLowerCase();
  const phone = cell(normalized.phone);
  const roles = mapRoles(cell(normalized.roles));
  const notification_preference = mapNotificationPreference(cell(normalized.notification_preference));
  const notes = cell(normalized.notes);
  const errorParts: string[] = [];

  if (!firstName) errorParts.push("First name is required.");
  if (!lastName) errorParts.push("Last name is required.");

  const duplicate = findDuplicate({ firstName, lastName, email, phone }, ministers);
  const status: ImportStatus = errorParts.length > 0 ? "Error" : duplicate ? "Possible Duplicate" : "New";

  return {
    id: `${index}-${firstName}-${lastName}`,
    first_name: firstName,
    last_name: lastName,
    email: email || undefined,
    phone: phone || undefined,
    roles,
    notification_preference,
    notes: notes || undefined,
    status,
    error: errorParts.join(" "),
    duplicate,
    decision: duplicate ? "skip" : "add",
  };
}

function normalizeHeaders(raw: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[key.trim().toLowerCase()];
    if (alias) normalized[alias] = value;
  }
  return normalized;
}

function cell(value: unknown): string {
  return String(value ?? "").trim();
}

function mapRoles(value: string): MinisterRole[] {
  const roles = value
    .split(",")
    .map((role) => ROLE_ALIASES[role.toLowerCase().replace(/[^a-z0-9]/g, "")])
    .filter(Boolean) as MinisterRole[];
  const unique = Array.from(new Set(roles));
  return unique.sort((a, b) => ROLE_DISPLAY_ORDER.indexOf(a) - ROLE_DISPLAY_ORDER.indexOf(b));
}

function mapNotificationPreference(value: string): "email" | "sms" | "both" | "none" {
  const normalized = value.toLowerCase().trim();
  if (["sms", "text", "phone"].includes(normalized)) return "sms";
  if (["both", "email + sms", "email and sms", "email/sms"].includes(normalized)) return "both";
  if (["none", "no", "off"].includes(normalized)) return "none";
  return "email";
}

function findDuplicate(
  row: { firstName: string; lastName: string; email: string; phone: string },
  ministers: Minister[]
) {
  const rowEmail = row.email.toLowerCase();
  if (rowEmail) {
    const byEmail = ministers.find((minister) => minister.email?.toLowerCase() === rowEmail);
    if (byEmail) return byEmail;
  }

  const rowName = normalizeName(`${row.firstName} ${row.lastName}`);
  const rowPhone = digits(row.phone);
  if (!rowName || !rowPhone) return undefined;

  return ministers.find((minister) => (
    normalizeName(`${minister.first_name} ${minister.last_name}`) === rowName &&
    phonesSimilar(rowPhone, digits(minister.phone ?? ""))
  ));
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function phonesSimilar(a: string, b: string) {
  if (!a || !b) return false;
  return a.slice(-7) === b.slice(-7);
}

function rowToMinister(row: ParsedRow): Minister {
  return {
    id: row.id,
    parish_id: "",
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    notification_preference: row.notification_preference,
    roles: row.roles,
    is_active: true,
    notes: row.notes ?? null,
    priest_type: null,
    minister_diocese: null,
    letter_of_suitability: null,
    letter_expiration_date: null,
    created_at: "",
  };
}

function DuplicatePanel({ title, minister }: { title: string; minister: Minister }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
      <div className="font-semibold text-slate-800">{title}: {minister.first_name} {minister.last_name}</div>
      <div>{minister.email || "No email"}</div>
      <div>{minister.phone || "No phone"}</div>
      <div>{minister.roles.map((role) => ROLE_SHORT_LABELS[role]).join(", ") || "No roles"}</div>
    </div>
  );
}
