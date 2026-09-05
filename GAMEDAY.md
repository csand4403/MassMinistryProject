# Get Over There Now 🏈

A live **college football** excitement router. It watches every in-progress game
at once, scores each one 0–100 on how much you'd regret missing it, ranks them,
and pushes you an alert the moment a game turns into must-see television.

It also knows who you root for — and who you root *against*.

Open `/gameday`.

College is the default because Saturdays are the problem worth solving: 60+
simultaneous games, and no way to know which one just got good. The NFL is
fully supported and is one toggle away in Settings.

> **Note on this repo:** this tool shares a Next.js deployment with the
> MassMinistry parish app but is otherwise completely independent — its own
> routes (`/gameday`, `/api/gameday/*`), its own code (`src/lib/football/`,
> `src/components/gameday/`), no shared database, and no auth. It is excluded
> from the parish auth middleware by design (see `src/middleware.ts`).

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000/gameday
```

That's it. No API key, no database, no account. The engine starts polling the
moment you open the dashboard and stops on its own when nothing is live.

Open **Settings** to pick your teams (see [Your teams and your
enemies](#your-teams-and-your-enemies)) and to switch the NFL on. Preferences
persist to `.gameday/settings.json`, so you set them once.

To get alerts on your phone, open **Settings** on the dashboard, put an
unguessable topic name in the ntfy field, then install the
[ntfy app](https://ntfy.sh/) and subscribe to the same topic. Hit **Test** to
confirm. Browser notifications work with no setup — just click *Enable on this
device*.

---

## How it works

```
ESPN scoreboard ──> provider ──> normalised LiveGame ──> excitement score
  (one request                                                  │
   per league                                            ┌──────┴──────┐
   per poll)                                             ▼             ▼
                                                    ranked board    alerting
                                                         │             │
                                                         ▼             ▼
                                                    SSE ─> dashboard  ntfy + browser
```

The poll loop (`src/lib/football/poller.ts`) runs every **20s** while games are
live and every **5 minutes** when nothing is. Each poll is a single HTTP request
per league: ESPN's scoreboard embeds live win probability, down and distance,
red-zone flags and possession inline, so no per-game fan-out is needed.

Updates reach the browser over **Server-Sent Events**. If the stream drops, the
dashboard silently falls back to polling `/api/gameday`.

---

## The excitement score

The full formula, with the reasoning behind every term, is documented at the top
of **`src/lib/football/excitement.ts`**. In short:

```
timeWeight = TIME_FLOOR + (1 - TIME_FLOOR) * urgency
tension    = W_CLOSENESS * closeness * timeWeight + W_VOLATILITY * volatility
score      = clamp(100 * tension + situationBonus, 0, 100)
```

| Term | Meaning |
|---|---|
| `closeness` | How near a coin flip the game is, from win probability. Falls back to a score-margin proxy when the provider has no win probability. |
| `volatility` | Total absolute win-probability *swing* over the last 5 minutes. This is what separates a wild back-and-forth from a static 50/50 slog. |
| `urgency` | How late it is, curved so the 4th quarter dominates. Overtime pins it to 1.0. |
| `timeWeight` | Urgency rescaled and applied **to closeness only** — so a late nail-biter soars while a late blowout stays near zero. |
| `situationBonus` | Flat points for red zone, 4th down, goal-line stands, under 2:00, overtime, onside kicks, and a trailing team with the ball. Capped, so tags alone can't fake a good game. |

One more adjustment sits outside that formula: when a game is **stopped** —
halftime, a weather delay, between quarters — the final score is multiplied by
`STOPPED_PLAY_MULTIPLIER` (0.35). Providers report these as "in progress"
(ESPN returns `STATUS_DELAYED` and `STATUS_HALFTIME` under `state: "in"`), but
there is nothing on screen to run to during a rain delay. In a live test, two
delayed games sat at rank #3 with a score of 27 before this damping and dropped
to #10–11 at a score of 9 after, with "Delayed" shown in the card's reason line.

## Your teams and your enemies

Pick teams in **Settings**. Both lists accept any number of teams from any
active league, and both are entirely optional — with nothing configured the
score is purely objective.

### ⭐ Your teams

A **flat premium** (`FAVORITE_INTEREST`, default 25) on any game your team is
playing. Flat is the important part: it is enough to win a dull slate — early
games cluster in the 20s, so your team lands near 50 and takes the top spot —
but never enough to beat somebody else's 4th-quarter thriller at 85.

An earlier version scaled the bonus by `(1 - objectiveScore)`, on the theory
that it should matter most when nothing else is on. That turned out to be
backwards: it paid the *biggest* bonus to the *least watchable* game, and in
live testing it put a favorite being blown out 28-0 above a neutral 3-point
game. A flat premium doesn't have that failure mode.

The one adjustment is `FAVORITE_DECIDED_TAPER`: once a game is both decided
*and* late, the premium fades. Down 35 in the 3rd is not appointment viewing
even for a diehard — but down 35 in the *1st* still might turn around, which is
why the taper is gated on urgency rather than on the margin alone.

### 😈 Hate watch

Deliberately **not** the mirror image of a favorite. You want your team's games
whatever the state; you only want your rival's game when it's going badly.

So the bonus scales with how much trouble they're in — `1 - theirWinProbability`
— sharpened by `HATE_CURVE` so it stays modest while they're merely behind and
ramps hard as they approach actual defeat. It's weighted by urgency (a rival
losing late is the event; losing early is a blip), and it adds a flat
`HATE_UPSET_BONUS` when a **ranked** rival is losing to a much lower-ranked or
unranked opponent, using AP rankings from the provider.

A rival cruising to a win gets nothing. That's the point.

Real example caught during development — an actual live game, not a mock-up:

```
 45 😈 BOIS@ORE 14-7  (fandom +18)
    UPSET ALERT: #2 ORE losing to BOIS, 4th & 1, 7-point game, 7:27 left in Q2
```

#2 Oregon trailing unranked Boise State went from 27 to 45 and took over the
board.

### Behavior guarantees

These are asserted against fixed scenarios by `npm run check:fandom`, so tuning
can't quietly break them:

| Behavior | Holds |
|---|---|
| Your team's normal game tops a boring slate | ✅ |
| Your team does **not** beat a genuine late thriller | ✅ |
| Your team being blown out stays below competitive neutral games | ✅ |
| A rival being upset late spikes hard (+31) | ✅ |
| A rival cruising to a win gets ~nothing (+0) | ✅ |
| Games with neither team are completely unaffected | ✅ |

## Tuning the algorithm

Every constant lives in one exported object, `EXCITEMENT_CONFIG`, at the top of
`src/lib/football/excitement.ts`. Change a number, then **replay a real game you
already know** to see what it did:

```bash
npm run replay -- 401772935 --league nfl
```

Game ids come from any ESPN box-score URL
(`espn.com/nfl/game/_/gameId/401772935` → `401772935`).

For the fandom bonuses, run the behavior check instead — replay has no notion
of who you support:

```bash
npm run check:fandom
```

The replay feeds ESPN's real per-play win-probability timeline through the exact
same scoring function the live engine uses, then prints the curve and the peak
moments. Two real games, scored by the current settings:

| Game | Peak | Mean Q1 | Mean Q4/OT |
|---|---|---|---|
| CHI 38 – 42 SF (shootout, decided on the last drive) | **100** | 38.3 | **76.0** |
| DAL 17 – 34 NYG (blowout) | 68 | 43.3 | **19.3** |

The thriller's top-scoring moments are its actual final drive — 4th & 5, red
zone, under two minutes, incomplete in the end zone at 0:04. The blowout decays
toward zero as it stops being a contest. That contrast is the property you're
tuning for; if a change breaks it, the change is wrong.

Useful knobs:

- **Alerts too noisy / too quiet** → the threshold slider on the dashboard, or
  `FOOTBALL_ALERT_THRESHOLD`.
- **Early games rated too highly** → lower `TIME_FLOOR` (how much a close game
  is worth at kickoff relative to the final seconds).
- **Wild games not surfacing fast enough** → raise `W_VOLATILITY`, or lower
  `VOLATILITY_FULL_SCALE` so less swing saturates the term.
- **Situational tags overpowering** → lower `MAX_SITUATION_BONUS`.
- **Halftime games showing too high / too low** → `STOPPED_PLAY_MULTIPLIER`.
- **Your team dominating the board** → lower `FAVORITE_INTEREST`; raise it if
  you want your team pinned to the top no matter what.
- **Hate watch too eager / too quiet** → `HATE_WATCH_MAX` and `HATE_CURVE`;
  `HATE_UPSET_BONUS` and `UPSET_RANK_GAP` control the upset kicker specifically.

Note that a genuine climax saturates at 100, so the very top moments aren't
distinguishable from each other. That's deliberate — at that point you should
already be watching — but if you want more resolution up there, raise
`MAX_SITUATION_BONUS`'s headroom by scaling the bonuses down.

---

## Swapping the data source

The data layer sits behind one interface, `ScoreboardProvider`
(`src/lib/football/providers/types.ts`). Nothing outside `providers/` knows ESPN
exists — everything else consumes the normalised `LiveGame` type.

To move to SportsDataIO, SportRadar, or anything else:

1. Write a class implementing `ScoreboardProvider`. The one required method is
   `fetchScoreboard(leagues)`, returning `LiveGame[]`. Implement the optional
   `fetchWinProbabilityTimeline()` too if you want `npm run replay` to work.
2. Register it in `src/lib/football/providers/index.ts`:
   ```ts
   const PROVIDERS = {
     espn: () => new EspnProvider(),
     mysource: () => new MySourceProvider(),
   };
   ```
3. Set `FOOTBALL_PROVIDER=mysource` in `.env.local`.

No other file changes.

### Missing data is normal

Not every game exposes win probability. In a live sample of 19 college games,
17 had down-and-distance and only 15 had win probability. Every field on
`LiveGame` that can be absent is typed nullable, and the scorer degrades to a
score-margin proxy rather than inventing a 50/50 bar. Cards say so explicitly
when win probability is unavailable.

ESPN also uses `-1` and `0` as sentinels for "no active down" (kickoffs, PATs,
between drives); the adapter normalises those to `null` so they don't fire bogus
4th-down bonuses. A provider you write should map its own equivalents onto
`LiveGame.isStopped` so halftime and delays get damped.

> **When tuning in dev:** the poll loop is a background timer, so Next's hot
> reload won't pick up changes to the scoring code in an already-running loop.
> Restart `npm run dev` after editing `excitement.ts`, or use `npm run replay`,
> which runs the current code every time.

---

## Alerting

When a game crosses your threshold, the alert fires once — then two guards stop
it repeating:

- **Cooldown** — never re-alert the same game within `cooldownMs` (default 10 min).
- **Re-arming** — after firing, the game must fall 10 points *below* the
  threshold before it's eligible again, so a game oscillating around 80 doesn't
  fire on every poll.

A game that stays hot for 10 straight polls produces 2 alerts, not 10.

Channels: **ntfy.sh** (server-side, reaches your phone) and the **Web
Notification API** (browser, no setup). To add another — Pushover, Discord, a
webhook — implement `NotifyChannel` in `src/lib/football/notify.ts` and add it
to `channelsFor()`.

---

## Configuration

All optional — the defaults work.

| Variable | Default | Purpose |
|---|---|---|
| `FOOTBALL_PROVIDER` | `espn` | Which data provider to use |
| `FOOTBALL_LEAGUES` | `college-football` | Leagues tracked before any settings are saved |
| `FOOTBALL_POLL_MS` | `20000` | Poll interval while games are live |
| `FOOTBALL_IDLE_POLL_MS` | `300000` | Poll interval when nothing is live |
| `FOOTBALL_ALERT_THRESHOLD` | `80` | Default alert threshold |
| `FOOTBALL_ALERT_COOLDOWN_MS` | `600000` | Per-game quiet period |
| `NTFY_TOPIC` | *(empty)* | ntfy topic; can also be set in the UI |
| `NTFY_SERVER` | `https://ntfy.sh` | Self-hosted ntfy server |
| `APP_BASE_URL` | *(empty)* | Used as the alert click-through link |
| `GAMEDAY_SETTINGS_PATH` | `.gameday/settings.json` | Where preferences persist |

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/gameday` | Current ranked slate (starts the engine on first call) |
| `GET /api/gameday/stream` | SSE push of the same snapshot |
| `GET /api/gameday/history` | Excitement timelines recorded this session; `?gameId=` for one |
| `GET,POST /api/gameday/settings` | Read / update threshold, cooldown, ntfy topic, leagues, teams |
| `GET /api/gameday/teams?league=` | Team list for the pickers (~760 college teams) |
| `POST /api/gameday/test-alert` | Send a test notification |

---

## Deployment

Runs as a **single unit** — one repo, one `npm run dev`, one `npm run build`.

One caveat worth knowing: engine state (win-probability history for the
volatility term, alert debounce bookkeeping, excitement timelines) is held **in
memory in a single process**. That's the right fit for a single-user personal
tool run with `npm start` on a always-on box, a Raspberry Pi, or a small VPS.

On a serverless platform each function instance gets its own empty copy, so the
volatility term would never warm up and debounce wouldn't hold across
invocations. If you deploy to Vercel or similar, move `winProbHistory`,
`alertState` and `timelines` out of `src/lib/football/store.ts` into Redis or
Postgres — the store is a small module with a narrow surface, deliberately, to
make exactly that swap easy.

---

## Limitations

- Win probability comes from ESPN's model; the app is only as good as that
  input, and the app never sees the model's own uncertainty.
- Onside kicks are detected by sniffing the play description, so an odd
  phrasing can miss one.
- "Get Over There" links to the ESPN gamecast. There's no reliable public deep
  link into a live broadcast stream, so the card surfaces the TV network
  carrying the game instead of pretending otherwise.
- ESPN's endpoints are undocumented and unversioned. They can change without
  notice — which is exactly why the provider seam exists.
