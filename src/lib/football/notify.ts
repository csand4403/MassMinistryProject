// ─────────────────────────────────────────────────────────────────────────────
// Notification channels.
//
// ntfy.sh is the default because it is the simplest thing that reaches a phone:
// no account, no API key, no VAPID key generation, no service worker. You POST
// a string to https://ntfy.sh/<topic> and any device subscribed to that topic
// buzzes. Pick an unguessable topic name — a topic is effectively a password.
//
// The dashboard ALSO raises a Web Notification in the browser (see the client
// hook), so an alert is visible even with no topic configured.
//
// To add a channel (Pushover, Discord, a webhook), implement `NotifyChannel`
// and add it to `channelsFor()`.
// ─────────────────────────────────────────────────────────────────────────────

import type { RankedGame } from "./types";
import { ALERT_DEFAULTS } from "./config";
import { getSettings } from "./store";

export interface NotifyChannel {
  name: string;
  send(alert: AlertPayload): Promise<void>;
}

export interface AlertPayload {
  title: string;
  message: string;
  score: number;
  /** Deep link back to the dashboard / gamecast. */
  url: string | null;
}

/** Build the human-facing alert text for a game that just got hot. */
export function buildAlert(entry: RankedGame, baseUrl: string | null): AlertPayload {
  const { game, excitement } = entry;
  // ASCII only: this string becomes an HTTP header (see sanitiseHeader), and
  // ntfy renders the football icon itself from the `Tags` header.
  const label = `${game.away.abbreviation} ${game.away.score}-${game.home.score} ${game.home.abbreviation}`;
  return {
    title: `${label} · ${excitement.score}`,
    message: excitement.headline,
    score: excitement.score,
    url: game.gamecastUrl ?? baseUrl,
  };
}

class NtfyChannel implements NotifyChannel {
  readonly name = "ntfy";
  constructor(private readonly topic: string, private readonly server: string) {}

  async send(alert: AlertPayload): Promise<void> {
    const url = `${this.server.replace(/\/$/, "")}/${encodeURIComponent(this.topic)}`;
    const headers: Record<string, string> = {
      // ntfy reads these headers rather than a JSON body.
      Title: sanitiseHeader(alert.title),
      // 5 = max priority; anything over 90 deserves to override a silent phone.
      Priority: alert.score >= 90 ? "5" : "4",
      Tags: "football",
    };
    if (alert.url) headers.Click = alert.url;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: alert.message,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`ntfy responded HTTP ${res.status}`);
    }
  }
}

/**
 * ntfy sends metadata as HTTP headers, which must be latin-1 and single-line.
 * Emoji in a header value will throw in undici, so strip anything unsafe.
 */
function sanitiseHeader(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    // Map the punctuation we actually use onto ASCII rather than deleting it,
    // so a stripped character never leaves a double space behind.
    .replace(/[—–]/g, "-")
    .replace(/·/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}

/** Which channels are currently configured. */
export function channelsFor(): NotifyChannel[] {
  const topic = getSettings().ntfyTopic || ALERT_DEFAULTS.ntfyTopic;
  const channels: NotifyChannel[] = [];
  if (topic) channels.push(new NtfyChannel(topic, ALERT_DEFAULTS.ntfyServer));
  return channels;
}

/**
 * Fan out to every configured channel. Returns the names that succeeded.
 * A channel failure is logged but never propagates — a dead notification
 * service must not stop the poll loop.
 */
export async function dispatch(alert: AlertPayload): Promise<string[]> {
  const channels = channelsFor();
  const delivered: string[] = [];
  await Promise.all(
    channels.map(async (channel) => {
      try {
        await channel.send(alert);
        delivered.push(channel.name);
      } catch (err) {
        console.error(`[gameday] ${channel.name} notification failed:`, err);
      }
    })
  );
  return delivered;
}
