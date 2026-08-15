# Post-op care

A phone-first web app for recovery at home: blood pressure, sugar and oxygen
readings with date, time and remarks, plus a daily medicine checklist that you
can edit as the prescription changes.

Next.js on Vercel, Neon Postgres for storage. Every device that opens the link
sees the same data.

---

## Deploy it

1. **Push this folder to GitHub.** Any new empty repo will do.
2. **Import it into Vercel** — [vercel.com/new](https://vercel.com/new), pick the
   repo, accept the defaults, deploy. The first build will fail with a message
   about a missing database. That is expected; step 3 fixes it.
3. **Attach the database.** In the Vercel project: **Storage → Create Database →
   Neon (Postgres) → Connect**. Vercel injects `DATABASE_URL` for you.
4. **Redeploy** — Deployments → the latest one → ⋯ → Redeploy. The tables create
   themselves the first time a page loads.
5. **Open the URL on the phone** and add it to the home screen (Safari: Share →
   Add to Home Screen; Chrome: ⋮ → Install app). It then behaves like a normal
   app, full screen, with its own icon.

### Settings worth changing

| Variable | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_TZ` | `Asia/Kolkata` | Timezone that dates and times are recorded in. |
| `APP_PIN` | *(unset)* | Leave unset and the app is open to anyone with the link. Set it (e.g. `4821`) and everyone must type that code once per device, then stays signed in for 30 days. |

Add either under **Settings → Environment Variables**, then redeploy.

> As deployed, there is no login. Anyone who has the URL — or is handed the phone —
> can read and edit these records. If that matters later, set `APP_PIN`.

## Run it locally

```bash
npm install
```

Put a Neon connection string in `.env.local` (copy `.env.example`), then:

```bash
npm run dev
```

## Using it

**Today** — the latest reading of each type with how long ago it was taken and
whether it sits in range, plus today's outstanding doses. Anything flagged
recently and anything left unmarked in the past few days surfaces here.

**Log** — one form for a whole sitting. Fill in only what was measured; blank
sections are skipped. The time defaults to now, and a coloured chip tells you how
each number reads against the targets *as you type*. The remark applies to every
reading in that entry.

**Medicines** — the day's doses in time order. Tap a row to mark it taken, tap
again to undo. **Mark all taken** clears a whole round at once. The ⋮ menu on each
row offers *skipped* (deliberately not taken) and *clear mark*. Use the arrows or
the date at the top to move to another day and fill in one you missed — doses
that were due but never marked show as **Not marked** in red once the day passes.

**Edit list** — add each dose time from the prescription. A twice-a-day tablet is
two entries. Each has a start date and either a course length in days or
"ongoing", so a 5-day antibiotic drops off the checklist by itself. *Stop* keeps
the history and removes it from future days; *Delete* erases its history too.

**History** — readings over 7, 30 or 90 days, filterable by type, with averages
and a count of how many fell outside target. The Medicines tab shows adherence:
overall percentage, per-medicine bars, and a day-by-day strip. **Export** downloads
one CSV with both tables — open it in Excel or print it for the next appointment.

**Settings** — the patient name, the surgery date (drives "day 12 after surgery"
on the home screen), and the target ranges behind every colour in the app. The
defaults are general reference bands; if the doctor gave different numbers, put
those in.

## Layout

| Path | What lives there |
| --- | --- |
| `app/page.tsx` | Today's dashboard |
| `app/log/` | The reading form |
| `app/meds/`, `app/meds/manage/` | Daily checklist, medicine list editor |
| `app/history/` | Readings, averages, adherence |
| `app/settings/` | Patient details and target ranges |
| `app/api/export/` | CSV download |
| `lib/db.ts` | Neon connection and the schema, created on first use |
| `lib/queries.ts` | All reads |
| `lib/actions.ts` | All writes (server actions) |
| `lib/ranges.ts` | Target bands and the in-range / out-of-range logic |
| `lib/date.ts` | Wall-clock date handling |
| `python-cli/` | The earlier terminal version, kept in case it is useful |

Dates are stored as local wall-clock strings (`2026-08-15 21:30`) rather than UTC
timestamps, so a dose taken at 9pm belongs to that evening on every device.

## One caution

The green / amber / red flags use general reference bands and are a prompt to
look closer, not a diagnosis. This app records what happened; it does not decide
what to do about it. For anything that looks wrong — or feels wrong regardless of
what the numbers say — call the doctor.
