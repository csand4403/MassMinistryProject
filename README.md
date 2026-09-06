# MassMinistry

Liturgical ministry scheduling application for **St. Michael the Archangel Catholic Church**.

Built for parish liturgy coordinators to manage Sunday and feast-day Mass assignments, track minister availability, and run real-time check-in on Sunday morning.

> **Also in this repo:** [`GAMEDAY.md`](./GAMEDAY.md) documents *Get Over There
> Now*, a standalone live-football dashboard served at `/gameday`. It shares
> this Next.js deployment but nothing else — no shared data, no auth, and no
> effect on the ministry app.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript) |
| Database    | Supabase (Postgres)                 |
| Auth        | Supabase Auth *(coming soon)*       |
| Styling     | Tailwind CSS                        |
| Email       | Resend *(coming soon)*              |
| Deployment  | Vercel *(coming soon)*              |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo>
cd MassMinistryProject
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase dashboard → **SQL Editor**, run the two migration files **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_data.sql`

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project URL and anon key (found in **Project Settings → API**).

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Application Structure

```
src/
├── app/
│   ├── page.tsx                     # Calendar View (home)
│   ├── mass/[date]/page.tsx         # Mass Day View
│   ├── mass/[date]/[massTimeId]/    # Mass Detail View (roster + check-in)
│   └── ministers/                   # Minister management (list, add, edit)
├── components/
│   ├── calendar/                    # CalendarGrid, MonthNav, CalendarLegend
│   ├── mass/                        # MassCard, RoleSection, CheckInButton,
│   │                                #   FeastBanner, AssignMinisterModal
│   └── ministers/                   # MinisterCard, MinisterForm
├── lib/
│   ├── supabase/client.ts           # Browser Supabase client
│   ├── supabase/server.ts           # Server Supabase client
│   ├── queries.ts                   # All read queries
│   ├── actions.ts                   # Server Actions (mutations)
│   ├── staffing.ts                  # RED/YELLOW/GREEN status logic
│   └── utils.ts                     # cn(), formatDate(), fullName()
├── types/index.ts                   # All TypeScript types + role constants
└── app/globals.css                  # Tailwind base + parish-card utility
```

---

## Screens

### Calendar View (`/`)
- Month grid; only Sundays and feast days are clickable.
- Each active day shows a **green / yellow / red dot** reflecting the worst-case staffing status across all Mass times that day.
- Month navigation arrows.

### Mass Day View (`/mass/YYYY-MM-DD`)
- Shows the date, liturgical season chip, and overall day status.
- **Feast banner** appears for high feasts and Holy Days of Obligation.
- Lists each Mass time as a card with quick roster summary.

### Mass Detail View (`/mass/YYYY-MM-DD/[massTimeId]`)
- Full roster ordered: Celebrant → Deacon → Lector I → Lector II → Psalmist → EMHC → Usher → Security.
- **Assign button** on each role opens a modal to select a qualified minister.
- **Check-in toggle** on each assigned minister logs arrival with timestamp.
- Live progress bar: *N / Total arrived*.

### Minister Management (`/ministers`)
- List with role-filter chips.
- **Add** and **Edit** forms.
- Per-minister profile with upcoming assignments.

---

## Staffing Status Logic

| Status | Meaning |
|--------|---------|
| 🔴 RED | No celebrant assigned — Mass cannot proceed without an ordained priest |
| 🟡 YELLOW | Celebrant assigned but deacon is missing, *or* any other ministry role (lector, EMHC, usher, security) has zero people assigned |
| 🟢 GREEN | All roles filled: celebrant, deacon, both lectors, psalmist, at least one EMHC, usher, and security |

The calendar shows the **worst status** across all Mass times for a given day.

---

## Liturgical Calendar

Pre-populated US Catholic holy days and high feasts for 2025–2026 per [USCCB norms](https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar):

- Mary, Mother of God (Jan 1) — **HOD**
- Ash Wednesday (moveable)
- Palm Sunday, Holy Thursday, Good Friday (moveable)
- Easter Sunday (moveable)
- Ascension of the Lord (transferred to Sunday in Archdiocese of Chicago)
- Pentecost Sunday (moveable)
- Assumption of Mary (Aug 15) — **HOD**
- All Saints Day (Nov 1) — **HOD**
- Immaculate Conception (Dec 8) — **HOD** (Patronal feast of USA)
- Christmas (Dec 25) — **HOD**

HOD = Holy Day of Obligation per USCCB standards.

---

## Seed Data

The seed migration creates:
- **Parish**: St. Michael the Archangel Catholic Church, Archdiocese of Chicago
- **15 ministers** across all roles (2 priests, 1 deacon, lectors, psalmists, EMHCs, ushers, security)
- **3 regular Mass times**: 8:00 AM, 10:30 AM, 12:00 PM
- **4 Sundays of assignments** (June 2026) with intentional GREEN, YELLOW, and RED examples to demonstrate the status system on first load

---

## Roadmap

- [ ] Supabase Auth (coordinator login)
- [ ] Resend email notifications for assignments
- [ ] Self-confirmation link for ministers (confirm/decline via email)
- [ ] Repeating Sunday templates (auto-generate dates for the year)
- [ ] Printer-friendly roster PDF export
- [ ] SMS via Twilio
