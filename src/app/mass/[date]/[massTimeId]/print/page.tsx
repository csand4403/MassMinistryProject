// ─────────────────────────────────────────────────────────────────────────────
// Mass Roster Print View
//
// A clean, one-page roster formatted for the sacristan to print on Sunday
// morning.  Roles appear in liturgical order: Priest, Deacon, Lectors,
// Psalmist, EMHCs, Ushers, Security.
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getMassTimeWithRoster,
  getLiturgicalDate,
} from "@/lib/queries";
import { ROLE_LABELS, ROLE_DISPLAY_ORDER } from "@/types";
import { formatDate, fullName } from "@/lib/utils";
import { PrintButton } from "@/components/mass/PrintButton";
import type { MinisterRole } from "@/types";

interface PageProps {
  params: Promise<{ date: string; massTimeId: string }>;
}

export default async function PrintRosterPage({ params }: PageProps) {
  const { date, massTimeId } = await params;

  const supabase = await createClient();
  const [massTime, litDate] = await Promise.all([
    getMassTimeWithRoster(supabase, massTimeId),
    getLiturgicalDate(supabase, date),
  ]);
  const parish = { name: "Mary Immaculate Catholic Church" };

  if (!massTime) notFound();

  // Group non-absent assignments by role
  const byRole = new Map<MinisterRole, typeof massTime.assignments>();
  for (const role of ROLE_DISPLAY_ORDER) {
    byRole.set(
      role,
      massTime.assignments.filter(
        (a) => a.role === role && a.status !== "ABSENT" && a.status !== "DECLINED"
      )
    );
  }

  const dateLabel = formatDate(date);
  const feastLabel =
    litDate?.feast_name ??
    (litDate?.is_holy_day_of_obligation ? "Holy Day of Obligation" : null);

  const printedOn = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* Screen-only toolbar — hidden during print via CSS */}
      <div className="no-print fixed top-4 right-4 z-10 flex gap-2">
        <PrintButton>Print Roster</PrintButton>
        <Link
          href={`/mass/${date}/${massTimeId}`}
          className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow transition-colors"
        >
          ← Back
        </Link>
      </div>

      {/* Roster page */}
      <div className="roster-page">
        {/* Header */}
        <header className="roster-header">
          <p className="parish-name">{parish.name}</p>
          <h1 className="roster-title">Sunday Ministry Roster</h1>
          <div className="roster-meta">
            <span>{dateLabel}</span>
            <span className="sep"> · </span>
            <span>
              {massTime.time_label} — {massTime.display_name}
            </span>
            {feastLabel && (
              <>
                <span className="sep"> · </span>
                <span className="feast">{feastLabel}</span>
              </>
            )}
          </div>
        </header>

        {/* Role rows */}
        <table className="roster-table">
          <tbody>
            {ROLE_DISPLAY_ORDER.map((role) => {
              const ministers = byRole.get(role) ?? [];
              return (
                <tr key={role} className="roster-row">
                  <td className="role-cell">{ROLE_LABELS[role]}</td>
                  <td className="minister-cell">
                    {ministers.length === 0 ? (
                      <span className="unassigned">— Unassigned —</span>
                    ) : (
                      ministers.map((a) => (
                        <div key={a.id} className="minister-name">
                          {fullName(a.minister!)}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <footer className="roster-footer">
          <span>Printed {printedOn}</span>
          <span className="sep"> · </span>
          <span>{parish.name} — Ministry Coordinator</span>
        </footer>
      </div>

      {/* Page-scoped styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; }
        }

        .roster-page {
          max-width: 720px;
          margin: 72px auto 40px;
          padding: 40px 48px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-family: Georgia, "Times New Roman", serif;
          color: #1e293b;
        }
        @media print {
          .roster-page {
            max-width: 100%;
            margin: 0;
            padding: 0.6in 0.8in;
            border: none;
            border-radius: 0;
          }
        }

        .roster-header {
          border-bottom: 2px solid #1e3a5f;
          padding-bottom: 16px;
          margin-bottom: 28px;
        }
        .parish-name {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0 0 4px;
        }
        .roster-title {
          font-size: 26px;
          font-weight: bold;
          color: #1e3a5f;
          margin: 0 0 8px;
        }
        .roster-meta { font-size: 13px; color: #475569; }
        .sep { color: #94a3b8; }
        .feast { font-style: italic; color: #6d28d9; }

        .roster-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 28px;
        }
        .roster-row { border-bottom: 1px solid #e2e8f0; }
        .roster-row:first-child { border-top: 1px solid #e2e8f0; }

        .role-cell {
          width: 220px;
          padding: 13px 16px 13px 0;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #475569;
          vertical-align: top;
          white-space: nowrap;
        }
        .minister-cell {
          padding: 13px 0;
          font-size: 15px;
          color: #1e293b;
          vertical-align: top;
          line-height: 1.65;
        }
        .minister-name { line-height: 1.7; }
        .unassigned {
          font-style: italic;
          color: #94a3b8;
          font-size: 14px;
        }

        .roster-footer {
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
}
