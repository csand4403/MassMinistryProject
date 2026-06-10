// ─────────────────────────────────────────────────────────────────────────────
// POST /api/send-reminders
//
// Sends a Sunday ministry reminder email to every assigned minister who has
// an email address on file.  Designed to be called by a Vercel Cron job
// every Thursday morning (see vercel.json) but can also be triggered
// manually from the dashboard.
//
// Security: requests must supply a Bearer token matching CRON_SECRET.
// Emails are sent via Resend using the RESEND_API_KEY environment variable.
//
// Required env vars:
//   RESEND_API_KEY        — Resend API key
//   RESEND_FROM_EMAIL     — Verified sender address (e.g. ministry@yourparish.org)
//   COORDINATOR_EMAIL     — Reply-to address for minister replies
//   CRON_SECRET           — Shared secret used to authorise cron calls
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getParish, getLiturgicalDateWithMasses } from "@/lib/queries";
import { ROLE_LABELS } from "@/types";
import { formatDate } from "@/lib/utils";
import { format, nextSunday, isSunday } from "date-fns";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Resend client ────────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 }
    );
  }
  const resend = new Resend(apiKey);

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "ministry@example.com";
  const replyTo =
    process.env.COORDINATOR_EMAIL ?? fromEmail;

  // ── Determine target Sunday ──────────────────────────────────────────────
  const today = new Date();
  // If today is Sunday send for today; otherwise send for next Sunday.
  const targetDate = isSunday(today) ? today : nextSunday(today);
  const dateStr = format(targetDate, "yyyy-MM-dd");

  // ── Load data ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const [parish, litDateWithMasses] = await Promise.all([
    getParish(supabase),
    getLiturgicalDateWithMasses(supabase, dateStr),
  ]);

  if (!litDateWithMasses || litDateWithMasses.mass_times.length === 0) {
    return NextResponse.json({
      message: `No Masses found for ${dateStr}.`,
      sent: 0,
    });
  }

  const dateLabel = formatDate(dateStr);
  const sentTo: string[] = [];
  const skipped: string[] = [];
  const errors: { email: string; error: string }[] = [];

  // ── Send one email per assignment with an email address ──────────────────
  for (const massTime of litDateWithMasses.mass_times) {
    for (const assignment of massTime.assignments) {
      const minister = assignment.minister;
      if (!minister?.email) {
        skipped.push(`${minister?.first_name ?? "?"} ${minister?.last_name ?? "?"} (no email)`);
        continue;
      }
      if (assignment.status === "ABSENT") continue;

      const roleLabel = ROLE_LABELS[assignment.role];

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: minister.email,
        replyTo: replyTo,
        subject: `Ministry Reminder – ${dateLabel} at ${parish.name}`,
        html: buildEmailHtml({
          firstName: minister.first_name,
          parishName: parish.name,
          dateLabel,
          timeLabel: massTime.time_label,
          displayName: massTime.display_name,
          roleLabel,
        }),
      });

      if (error) {
        errors.push({ email: minister.email, error: error.message });
      } else {
        sentTo.push(minister.email);
      }
    }
  }

  return NextResponse.json({
    date: dateStr,
    parish: parish.name,
    sent: sentTo.length,
    sentTo,
    skipped,
    errors,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML template
// ─────────────────────────────────────────────────────────────────────────────

function buildEmailHtml({
  firstName,
  parishName,
  dateLabel,
  timeLabel,
  displayName,
  roleLabel,
}: {
  firstName: string;
  parishName: string;
  dateLabel: string;
  timeLabel: string;
  displayName: string;
  roleLabel: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ministry Reminder — ${parishName}</title>
  <style>
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1e293b;
      background: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 560px;
      margin: 32px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .top-bar {
      height: 4px;
      background: #1e3a5f;
    }
    .header {
      padding: 24px 28px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .parish-name {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 4px;
    }
    .title {
      font-size: 22px;
      font-weight: bold;
      color: #1e3a5f;
      margin: 0;
    }
    .body {
      padding: 24px 28px;
    }
    p {
      font-size: 15px;
      line-height: 1.7;
      color: #334155;
      margin: 0 0 16px;
    }
    .detail-box {
      background: #f1f5f9;
      border-left: 3px solid #1e3a5f;
      border-radius: 0 6px 6px 0;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      align-items: baseline;
      margin: 6px 0;
      font-size: 14px;
    }
    .detail-label {
      width: 52px;
      flex-shrink: 0;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #64748b;
      padding-top: 2px;
    }
    .detail-value {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }
    .footer {
      padding: 20px 28px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer strong {
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-bar"></div>
    <div class="header">
      <p class="parish-name">${parishName}</p>
      <h1 class="title">Ministry Reminder</h1>
    </div>
    <div class="body">
      <p>Dear ${firstName},</p>
      <p>
        You are scheduled to serve at <strong>${parishName}</strong> this Sunday.
        Please review your assignment below.
      </p>
      <div class="detail-box">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${dateLabel}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Mass</span>
          <span class="detail-value">${timeLabel} &mdash; ${displayName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Role</span>
          <span class="detail-value">${roleLabel}</span>
        </div>
      </div>
      <p>
        You may reply to this email to confirm your attendance or to let us
        know if you are unable to serve. Please notify us as soon as possible
        so we can arrange a substitute if needed.
      </p>
      <p>Thank you for your ministry and for your service to our parish family.</p>
    </div>
    <div class="footer">
      <p>God bless,<br /><strong>${parishName}</strong><br />Ministry Coordinator</p>
    </div>
  </div>
</body>
</html>`;
}
