import crypto from "node:crypto";
import { Resend } from "resend";
import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { MASS_TYPE_LABELS, ROLE_LABELS, type MassType, type MinisterRole } from "@/types";
import { normalizeRole } from "@/lib/staffing";

type AssignmentEmailResult =
  | { sent: true; email: string }
  | { sent: false; reason: string };

interface AssignmentEmailRow {
  id: string;
  role: string;
  minister: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  mass_time: {
    time_label: string;
    display_name: string;
    mass_type: MassType;
    liturgical_date: {
      date: string;
      feast_name: string | null;
      parish: {
        name: string;
      } | null;
    } | null;
  } | null;
}

export async function sendAssignmentEmail(assignmentId: string): Promise<AssignmentEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not configured." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assignment")
    .select(`
      id, role,
      minister(first_name, last_name, email),
      mass_time(
        time_label, display_name, mass_type,
        liturgical_date(date, feast_name, parish(name))
      )
    `)
    .eq("id", assignmentId)
    .single();

  if (error) return { sent: false, reason: error.message };

  const assignment = data as unknown as AssignmentEmailRow;
  const minister = assignment.minister;
  const massTime = assignment.mass_time;
  const litDate = massTime?.liturgical_date;
  const parishName = litDate?.parish?.name ?? "Mary Immaculate Catholic Church";

  if (!minister?.email) return { sent: false, reason: "Minister does not have an email address." };
  if (!massTime || !litDate) return { sent: false, reason: "Assignment is missing Mass details." };

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 21).toISOString();

  const { error: tokenError } = await supabase
    .from("assignment_response_token")
    .insert({
      assignment_id: assignment.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (tokenError) return { sent: false, reason: tokenError.message };

  const baseUrl = appBaseUrl();
  const confirmUrl = `${baseUrl}/api/assignments/respond?token=${encodeURIComponent(rawToken)}&status=CONFIRMED`;
  const declineUrl = `${baseUrl}/api/assignments/respond?token=${encodeURIComponent(rawToken)}&status=DECLINED`;
  const role = normalizeRole(assignment.role) as MinisterRole;
  const roleLabel = ROLE_LABELS[role] ?? assignment.role;
  const dateLabel = formatDate(litDate.date);
  const massLabel = litDate.feast_name ?? MASS_TYPE_LABELS[massTime.mass_type] ?? massTime.display_name;

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "ministry@example.com";
  const replyTo = process.env.COORDINATOR_EMAIL ?? fromEmail;

  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: minister.email,
    replyTo,
    subject: `New Ministry Assignment - ${dateLabel}`,
    html: buildAssignmentEmailHtml({
      firstName: minister.first_name,
      parishName,
      dateLabel,
      massLabel,
      timeLabel: massTime.time_label,
      displayName: massTime.display_name,
      roleLabel,
      confirmUrl,
      declineUrl,
    }),
  });

  if (emailError) return { sent: false, reason: emailError.message };
  return { sent: true, email: minister.email };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function buildAssignmentEmailHtml({
  firstName,
  parishName,
  dateLabel,
  massLabel,
  timeLabel,
  displayName,
  roleLabel,
  confirmUrl,
  declineUrl,
}: {
  firstName: string;
  parishName: string;
  dateLabel: string;
  massLabel: string;
  timeLabel: string;
  displayName: string;
  roleLabel: string;
  confirmUrl: string;
  declineUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Ministry Assignment</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <div style="height:4px;background:#1e3a5f;"></div>
    <div style="padding:24px 28px 20px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(parishName)}</p>
      <h1 style="margin:0;font-size:22px;color:#1e3a5f;">New Ministry Assignment</h1>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${escapeHtml(firstName)},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">You have been assigned to serve at ${escapeHtml(parishName)}. Please confirm or decline below.</p>
      <div style="background:#f1f5f9;border-left:3px solid #1e3a5f;border-radius:0 6px 6px 0;padding:16px 20px;margin:20px 0;">
        <p style="margin:6px 0;"><strong>Date:</strong> ${escapeHtml(dateLabel)}</p>
        <p style="margin:6px 0;"><strong>Mass:</strong> ${escapeHtml(timeLabel)} - ${escapeHtml(displayName)}</p>
        <p style="margin:6px 0;"><strong>Type:</strong> ${escapeHtml(massLabel)}</p>
        <p style="margin:6px 0;"><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
      </div>
      <p style="margin:24px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;border-radius:6px;padding:10px 16px;font-weight:bold;margin-right:8px;">Confirm</a>
        <a href="${declineUrl}" style="display:inline-block;background:#ffffff;color:#b91c1c;text-decoration:none;border:1px solid #fecaca;border-radius:6px;padding:9px 16px;font-weight:bold;">Decline</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0;">These links expire in 21 days and can only be used once.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
