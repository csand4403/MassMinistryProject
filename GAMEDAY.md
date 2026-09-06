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

## Dashboard design notes

The board is glanced at on a phone, in a dark room, during a commercial break.
That single sentence drove most of the decisions:

- **Dark by default.** Evening viewing is the whole use case, and a dark ground
  lets team colors and the excitement number carry the hierarchy. Light and
  "follow the OS" are both available in Settings.
- **Exactly one thing is biggest.** The excitement score. Everything else is
  support. Data density is the enemy of a "where do I go" decision, so the card
  shows the four things that answer it and nothing else.
- **Changes animate, they don't blink.** Scores and excitement count up over
  ~450ms and briefly tint; a card whose score changed pulses once. Hard-cutting
  numbers get missed entirely (change blindness); flashing ones become noise.
- **Team color as an accent, never a fill.** A thin bar beside each team and the
  win-probability bar itself. Brand recognition without a contrast problem.
- **Team logos** load from the provider (all 99 games in a live sample carried
  logo URLs for both sides). A team without one falls back to a neutral dot
  rather than a broken image.
- **Trust signals.** A connection dot, a live "updated 12s ago" that ticks on
  its own, and a manual refresh — so when a number looks stale you can confirm
  it rather than wonder whether the stream died.
- **Settings as a bottom sheet.** The old inline accordion pushed the board
  down and you lost your place.

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
| `NTFY_TOPIC` | *(empty)* | ntfy topic for server-side phone pushes |
| `NTFY_SERVER` | `https://ntfy.sh` | Self-hosted ntfy server |
| `APP_BASE_URL` | *(empty)* | Used as the alert click-through link |
| `GAMEDAY_SETTINGS_PATH` | `.gameday/settings.json` | Where the server's own preferences persist |
| `GAMEDAY_ONLY` | *(unset)* | `1` serves only the football app; parish routes 404. **Set this on any shared deployment.** |

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/gameday` | Current ranked slate (starts the engine on first call) |
| `GET /api/gameday/stream` | SSE push of the same snapshot |
| `GET /api/gameday/history` | Excitement timelines recorded this session; `?gameId=` for one |
| `GET,POST /api/gameday/settings` | Read / update threshold, cooldown, ntfy topic, leagues, teams |
| `GET /api/gameday/teams?league=` | Team list for the pickers (~760 college teams) |
| `GET /api/gameday/health` | Liveness probe — engine state, no upstream call |
| `POST /api/gameday/test-alert` | Send a test notification |

---

## Putting it on a public URL

### ⚠️ Read this first

This repo also contains the **MassMinistry parish app**, and the repo is
**public**. Two things follow:

1. **Always set `GAMEDAY_ONLY=1`** on any deployment you share. It makes `/`
   redirect to `/gameday` and every parish route return 404, so a link you hand
   out cannot reach the scheduling app. The Render blueprint sets it for you.
2. **Rotate the Supabase keys.** `.env.local.example` currently has a real
   `service_role` key committed to a public repo. That key bypasses row-level
   security entirely. See [Rotating the leaked key](#rotating-the-leaked-key).

### Option A — Render (recommended, free, persistent)

```bash
git push                       # push this branch
# render.com -> New -> Blueprint -> pick this repo -> Apply
```

Verified end to end from a clean checkout: `npm ci --include=dev && npm run
build && npm start` under the blueprint's exact environment, then checked that
`/` redirects, `/gameday` and the health endpoint return 200, every parish
route 404s, and 99 games poll with no error.

`render.yaml` is committed, so Render builds it and hands back a public
`https://<name>.onrender.com` URL. Share that.

The free instance sleeps after ~15 minutes idle; the next visit takes ~30s to
wake and starts with an empty volatility history (scores are still correct, the
"recent swing" term just needs a few polls to warm up). Bump the instance type
if you want it awake all Saturday.

### Option B — instant tunnel (nothing to sign up for)

Fastest way to get a friend looking at what's on your screen right now:

```bash
GAMEDAY_ONLY=1 npm run build && GAMEDAY_ONLY=1 npm start   # terminal 1
npx cloudflared tunnel --url http://localhost:3000          # terminal 2
```

Cloudflared prints a public `https://….trycloudflare.com` URL. It lives only
as long as both commands run, which makes it ideal for "watch this with me
right now" and useless for anything permanent.

### Why not Vercel

Vercel is the obvious choice for Next.js and the wrong one here. This app polls
on a timer and keeps win-probability history **in memory** to measure
volatility, which needs one long-lived process. On serverless each request can
land on a different cold instance, so the volatility term never warms up and
alert debouncing never holds — you'd get repeat notifications for the same
game.

If you do want serverless, move `winProbHistory`, `alertState` and `timelines`
out of `src/lib/football/store.ts` into Redis. The store is deliberately a
small module with a narrow surface to make exactly that swap easy.

### What your friends see

Preferences — teams, threshold, leagues, theme — are stored **per browser** in
`localStorage`, and the board is re-ranked locally from them. So everyone who
opens the link gets their own teams and their own ranking, and nobody
overwrites anybody. Browser notifications likewise follow each viewer's own
threshold.

The one shared thing is the **ntfy push channel**: the server sends those, so
they use the deployment's own `NTFY_TOPIC` and the owner's saved teams. If you
want your friend to get phone pushes for *his* teams, he needs his own
deployment.

## Rotating the leaked key

`.env.local.example` in this public repo contains a live Supabase
`service_role` key (and the anon key). Removing the file does **not** help on
its own — git history keeps it, and anyone can read history on a public repo.

1. Supabase dashboard → Project Settings → API → **roll** both the `anon` and
   `service_role` keys.
2. Put the new values in `.env.local` (already gitignored) and in the Vercel
   project's environment variables.
3. Replace `.env.local.example` with placeholders (`your-anon-key-here`), not
   real values.
4. Consider making the repo private, or extracting this dashboard into its own
   repo so it can be public without dragging parish code along.

Step 1 is the one that actually matters — until the keys are rolled, they are
compromised regardless of what happens to the file.

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
