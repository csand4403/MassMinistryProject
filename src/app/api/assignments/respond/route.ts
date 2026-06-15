import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/assignment-email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const status = url.searchParams.get("status");

  if (!token || (status !== "CONFIRMED" && status !== "DECLINED")) {
    return responsePage("Invalid Link", "This assignment response link is missing required information.", 400);
  }

  const supabase = createAdminClient();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("assignment_response_token")
    .select("id, assignment_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    return responsePage("Response Error", tokenError.message, 500);
  }

  if (!tokenRow || tokenRow.used_at || tokenRow.expires_at < now) {
    return responsePage("Link Expired", "This assignment response link has already been used or has expired.", 410);
  }

  const { error: assignmentError } = await supabase
    .from("assignment")
    .update({ status })
    .eq("id", tokenRow.assignment_id);

  if (assignmentError) {
    return responsePage("Response Error", assignmentError.message, 500);
  }

  const { error: usedError } = await supabase
    .from("assignment_response_token")
    .update({ used_at: now })
    .eq("id", tokenRow.id);

  if (usedError) {
    return responsePage("Response Error", usedError.message, 500);
  }

  return responsePage(
    status === "CONFIRMED" ? "Assignment Confirmed" : "Assignment Declined",
    status === "CONFIRMED"
      ? "Thank you. Your ministry assignment has been confirmed."
      : "Thank you. Your decline has been recorded so the scheduler can reassign the role.",
    200
  );
}

function responsePage(title: string, message: string, status: number) {
  return new NextResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #f8f7f5; color: #1e293b; font-family: Arial, Helvetica, sans-serif; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    section { max-width: 460px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
    h1 { margin: 0 0 8px; color: #1e3a5f; font-size: 24px; }
    p { margin: 0; line-height: 1.6; color: #475569; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </section>
  </main>
</body>
</html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
