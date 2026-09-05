// ─────────────────────────────────────────────────────────────────────────────
// Provider registry — the single place to swap the data source.
//
// To move off ESPN:
//   1. Write a class implementing `ScoreboardProvider` (see ./types.ts).
//   2. Register it in PROVIDERS below.
//   3. Set FOOTBALL_PROVIDER=<name> in .env.local.
//
// No other file in the app needs to change.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScoreboardProvider } from "./types";
import { EspnProvider } from "./espn";

const PROVIDERS: Record<string, () => ScoreboardProvider> = {
  espn: () => new EspnProvider(),
};

let cached: ScoreboardProvider | null = null;

export function getProvider(): ScoreboardProvider {
  if (cached) return cached;

  const requested = (process.env.FOOTBALL_PROVIDER ?? "espn").toLowerCase();
  const factory = PROVIDERS[requested];

  if (!factory) {
    console.warn(
      `[football] unknown FOOTBALL_PROVIDER "${requested}"; ` +
        `falling back to "espn". Known providers: ${Object.keys(PROVIDERS).join(", ")}`
    );
    cached = PROVIDERS.espn();
    return cached;
  }

  cached = factory();
  return cached;
}

export type { ScoreboardProvider };
