// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/gameday/settings — read and update alert settings live.
// Single-user personal tool: no auth, by design (see README).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/football/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;
  const next: Parameters<typeof updateSettings>[0] = {};

  if (patch.threshold !== undefined) {
    const threshold = Number(patch.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: "threshold must be a number between 0 and 100" },
        { status: 400 }
      );
    }
    next.threshold = Math.round(threshold);
  }

  if (patch.cooldownMs !== undefined) {
    const cooldownMs = Number(patch.cooldownMs);
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
      return NextResponse.json(
        { error: "cooldownMs must be a non-negative number" },
        { status: 400 }
      );
    }
    next.cooldownMs = Math.round(cooldownMs);
  }

  if (patch.ntfyTopic !== undefined) {
    if (typeof patch.ntfyTopic !== "string") {
      return NextResponse.json(
        { error: "ntfyTopic must be a string" },
        { status: 400 }
      );
    }
    next.ntfyTopic = patch.ntfyTopic.trim().slice(0, 100);
  }

  return NextResponse.json(updateSettings(next));
}
