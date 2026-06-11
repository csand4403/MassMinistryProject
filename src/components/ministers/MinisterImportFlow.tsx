"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { bulkImportMinisters } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { ROLE_SHORT_LABELS, ROLE_DISPLAY_ORDER, PRIEST_TYPE_LABELS } from "@/types";
import type { Minister, MinisterRole, PriestType } from "@/types";
import type { MinisterImportReview } from "@/lib/actions";

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
  priest_type?: PriestType | null;
  minister_diocese?: string;
  letter_of_suitability?: boolean | null;
  letter_expiration_date?: string | null;
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
  "priest type": "priest_type",
  priesttype: "priest_type",
  "minister diocese": "minister_diocese",
  diocese: "minister_diocese",
  "letter of suitability": "letter_of_suitability",
  letterofsuitability: "letter_of_suitability",
  "letter expiration date": "letter_expiration_date",
  letterexpirationdate: "letter_expiration_date",
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

const PRIEST_TYPE_ALIASES: Record<string, PriestType> = {
  pastor: "PASTOR_ON_STAFF",
  pastoronstaff: "PASTOR_ON_STAFF",
  associate: "ASSOCIATE_ON_STAFF",
  associateonstaff: "ASSOCIATE_ON_STAFF",
  visiting: "VISITING_CELEBRANT",
  visitingcelebrant: "VISITING_CELEBRANT",
};

const CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Roles",
  "Notification Preference",
  "Notes",
  "Priest Type",
  "Minister Diocese",
  "Letter of Suitability",
  "Letter Expiration Date",
];

const VALID_ROLE_NAMES = ROLE_DISPLAY_ORDER.map((role) => ROLE_SHORT_LABELS[role]).join(", ");
const RECENT_IMPORTS_KEY = "mass-ministry-recent-imports";

export function MinisterImportFlow({ ministers }: MinisterImportFlowProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeReview, setActiveReview] = useState<MinisterImportReview | null>(null);
  const [recentImports, setRecentImports] = useState<MinisterImportReview[]>([]);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRecentImports(readRecentImports());
  }, []);

  const counts = useMemo(() => ({
    newRows: rows.filter((row) => row.status === "New").length,
    duplicates: rows.filter((row) => row.status === "Possible Duplicate").length,
    errors: rows.filter((row) => row.status === "Error").length,
  }), [rows]);

  const handleFile = async (file: File) => {
    setParseError(null);
    setActiveReview(null);
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
    setActiveReview(null);

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
        priest_type: row.priest_type,
        minister_diocese: row.minister_diocese,
        letter_of_suitability: row.letter_of_suitability,
        letter_expiration_date: row.letter_expiration_date,
        duplicate_id: row.duplicate?.id,
        decision: row.status === "Possible Duplicate" ? row.decision : "add",
      })), fileName);

      if (!result.success) {
        setCommitError(result.error ?? "Import failed.");
        return;
      }

      if (result.review) {
        const next = [result.review, ...readRecentImports().filter((item) => item.id !== result.review?.id)].slice(0, 5);
        localStorage.setItem(RECENT_IMPORTS_KEY, JSON.stringify(next));
        setRecentImports(next);
        setActiveReview(result.review);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Upload CSV or XLSX</h3>
            <p className="mt-1 text-xs text-slate-500">
              Valid roles: {VALID_ROLE_NAMES}. Use commas for multiple roles.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-navy-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              Download Sample CSV
            </button>
            <button
              type="button"
              onClick={() => downloadMinistersCsv(ministers)}
              className="rounded-md bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-700"
            >
              Export Ministers
            </button>
          </div>
        </div>
        <label className="block">
          <span className="sr-only">Upload CSV or XLSX</span>
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
        </div>
      )}

      {activeReview && <ImportReviewDashboard review={activeReview} />}
      {recentImports.length > 0 && (
        <RecentImports imports={recentImports} activeId={activeReview?.id} onSelect={setActiveReview} />
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
  const priest_type = mapPriestType(cell(normalized.priest_type));
  const minister_diocese = cell(normalized.minister_diocese);
  const letter_of_suitability = mapBoolean(cell(normalized.letter_of_suitability));
  const letter_expiration_date = cell(normalized.letter_expiration_date);
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
    priest_type,
    minister_diocese: minister_diocese || undefined,
    letter_of_suitability,
    letter_expiration_date: letter_expiration_date || undefined,
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

function mapPriestType(value: string): PriestType | null {
  if (!value) return null;
  return PRIEST_TYPE_ALIASES[value.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null;
}

function mapBoolean(value: string): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (["yes", "true", "y", "1"].includes(normalized)) return true;
  if (["no", "false", "n", "0"].includes(normalized)) return false;
  return null;
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
    priest_type: row.priest_type ?? null,
    minister_diocese: row.minister_diocese ?? null,
    letter_of_suitability: row.letter_of_suitability ?? null,
    letter_expiration_date: row.letter_expiration_date ?? null,
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

function ImportReviewDashboard({ review }: { review: MinisterImportReview }) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Import Review</h3>
        <p className="mt-1 text-sm text-slate-500">
          {review.added.length} added, {review.merged.length} merged, {review.skipped.length} skipped
          {review.file_name ? ` from ${review.file_name}` : ""}.
        </p>
      </div>

      <ReviewSection title="Added" items={review.added} empty="No ministers were added." />
      <ReviewSection title="Merged" items={review.merged} empty="No duplicate ministers were merged." />
      <ReviewSection title="Skipped" items={review.skipped} empty="No rows were skipped." skipped />
    </section>
  );
}

function ReviewSection({
  title,
  items,
  empty,
  skipped = false,
}: {
  title: string;
  items: NonNullable<MinisterImportReview["added"]>;
  empty: string;
  skipped?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
          {items.map((item) => (
            <div key={`${title}-${item.row}-${item.name}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
              <div>
                <div className="font-medium text-slate-900">Row {item.row}: {item.name}</div>
                {item.reason && <div className="text-xs text-red-700">{item.reason}</div>}
                {item.changes && <div className="text-xs text-slate-500">{item.changes.join("; ")}</div>}
              </div>
              {!skipped && item.minister_id && (
                <Link
                  href={`/ministers/${item.minister_id}/edit`}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Edit
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentImports({
  imports,
  activeId,
  onSelect,
}: {
  imports: MinisterImportReview[];
  activeId?: string;
  onSelect: (review: MinisterImportReview) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Recent Imports</h3>
      <div className="mt-3 grid gap-2">
        {imports.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm ring-1 transition-colors",
              activeId === item.id
                ? "bg-navy-800 text-white ring-navy-800"
                : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-white"
            )}
          >
            <span className="font-medium">{formatImportDate(item.imported_at)}</span>
            <span className="ml-2 text-xs opacity-80">
              {item.added.length} added, {item.merged.length} merged, {item.skipped.length} skipped
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function readRecentImports(): MinisterImportReview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_IMPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function downloadSampleCsv() {
  const rows = [
    CSV_HEADERS,
    ["Maria", "Garcia", "maria@example.com", "214-555-0111", "Lector", "email", "Single-role example", "", "", "", ""],
    ["Thomas", "Nguyen", "thomas@example.com", "214-555-0112", "Lector, EMHC, Usher", "both", "Multi-role example", "", "", "", ""],
    ["Fr. James", "O'Brien", "frjames@example.com", "214-555-0113", "Priest", "email", "Visiting celebrant", "Visiting Celebrant", "Diocese of Dallas", "Yes", "2026-12-31"],
    ["Missing", "", "skip@example.com", "", "Psalmist", "email", "Skipped example: missing last name", "", "", "", ""],
  ];
  downloadCsv("minister-import-sample.csv", rows);
}

function downloadMinistersCsv(ministers: Minister[]) {
  const rows = [
    CSV_HEADERS,
    ...ministers.map((minister) => [
      minister.first_name,
      minister.last_name,
      minister.email ?? "",
      minister.phone ?? "",
      minister.roles.map((role) => ROLE_SHORT_LABELS[role]).join(", "),
      minister.notification_preference,
      minister.notes ?? "",
      minister.priest_type ? PRIEST_TYPE_LABELS[minister.priest_type] : "",
      minister.minister_diocese ?? "",
      minister.letter_of_suitability == null ? "" : minister.letter_of_suitability ? "Yes" : "No",
      minister.letter_expiration_date ?? "",
    ]),
  ];
  downloadCsv(`ministers-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatImportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
