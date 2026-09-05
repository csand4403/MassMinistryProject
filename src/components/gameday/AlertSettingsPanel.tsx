"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Threshold + notification controls. Collapsed by default so the board stays
// the focus on a phone screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { AlertSettings } from "./useGameday";
import { requestNotificationPermission } from "./useGameday";

export function AlertSettingsPanel({
  settings,
  onChange,
}: {
  settings: AlertSettings;
  onChange: (patch: Partial<AlertSettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState(settings.ntfyTopic);
  const [permission, setPermission] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const enableBrowserAlerts = async () => {
    setPermission(await requestNotificationPermission());
  };

  const sendTest = async () => {
    setTestResult("Sending…");
    try {
      const res = await fetch("/api/gameday/test-alert", { method: "POST" });
      const data = (await res.json()) as { message?: string };
      setTestResult(data.message ?? "Sent.");
    } catch {
      setTestResult("Failed to reach the server.");
    }
  };

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-700">
          Alert me at{" "}
          <span className="tabular-nums text-red-600">{settings.threshold}+</span>
        </span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Settings"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {/* ── Threshold ─────────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="threshold"
              className="flex items-center justify-between text-xs font-medium text-slate-600"
            >
              <span>Excitement threshold</span>
              <span className="tabular-nums text-slate-900">
                {settings.threshold}
              </span>
            </label>
            <input
              id="threshold"
              type="range"
              min={40}
              max={100}
              step={1}
              value={settings.threshold}
              onChange={(e) => onChange({ threshold: Number(e.target.value) })}
              className="mt-2 w-full accent-red-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Higher means fewer, more urgent alerts. 80 is a good starting point.
            </p>
          </div>

          {/* ── Cooldown ──────────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="cooldown"
              className="flex items-center justify-between text-xs font-medium text-slate-600"
            >
              <span>Quiet period per game</span>
              <span className="tabular-nums text-slate-900">
                {Math.round(settings.cooldownMs / 60000)} min
              </span>
            </label>
            <input
              id="cooldown"
              type="range"
              min={1}
              max={30}
              step={1}
              value={Math.round(settings.cooldownMs / 60000)}
              onChange={(e) =>
                onChange({ cooldownMs: Number(e.target.value) * 60000 })
              }
              className="mt-2 w-full accent-slate-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              A game that stays hot won&apos;t alert again inside this window.
            </p>
          </div>

          {/* ── Browser notifications ─────────────────────────────────────── */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">
              Browser notifications
            </p>
            <button
              onClick={enableBrowserAlerts}
              className="mt-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
            >
              Enable on this device
            </button>
            {permission && (
              <p className="mt-1 text-[11px] text-slate-500">
                Permission: {permission}
              </p>
            )}
          </div>

          {/* ── ntfy push ─────────────────────────────────────────────────── */}
          <div className="rounded-lg bg-slate-50 p-3">
            <label
              htmlFor="ntfy"
              className="text-xs font-medium text-slate-600"
            >
              Phone push via ntfy.sh
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="ntfy"
                type="text"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onBlur={() => onChange({ ntfyTopic: topicDraft.trim() })}
                placeholder="your-secret-topic-name"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <button
                onClick={sendTest}
                className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
              >
                Test
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Install the ntfy app and subscribe to this topic. Anyone who knows
              the name can read it — pick something unguessable.
            </p>
            {testResult && (
              <p className="mt-1 text-[11px] text-slate-600">{testResult}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
