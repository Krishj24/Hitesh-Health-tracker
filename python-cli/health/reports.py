"""Day summaries, history, adherence and CSV export."""

import csv
import os
from datetime import date, datetime, timedelta

from . import db, meds, ui, vitals

EXPORT_DIR = os.path.join(db.APP_DIR, "exports")


def _days_back(n):
    today = date.today()
    return [(today - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)]


# --- dashboard --------------------------------------------------------------

def dashboard():
    name = db.get_setting("patient_name")
    today = db.today_str()
    ui.header(f"{name} -- post-op care", ui.pretty_day(today))

    surgery = db.get_setting("surgery_date")
    if surgery:
        try:
            day_n = (date.today() - date.fromisoformat(surgery)).days
            print(ui.dim(f"  Day {day_n} after surgery ({surgery})"))
        except ValueError:
            pass

    print()
    print(ui.bold("  Latest readings"))
    ui.rule()
    rows = []
    for kind, label in (("bp", "Blood pressure"), ("sugar", "Blood sugar"), ("spo2", "Oxygen")):
        row = vitals.latest(kind)
        if not row:
            rows.append([label, ui.dim("not recorded yet"), "", ""])
            continue
        text, level, note = vitals.describe(row)
        age = _age(row["taken_at"])
        rows.append([label, text, vitals.paint(level, note), ui.dim(age)])
    ui.table(["", "Reading", "Status", "When"], rows)

    print()
    print(ui.bold("  Medicines today"))
    ui.rule()
    scheduled = meds.scheduled_for(today)
    if not scheduled:
        ui.info(ui.dim("No medicines scheduled."))
    else:
        doses = meds.dose_map(today)
        taken = sum(1 for m in scheduled
                    if doses.get(m["id"]) and doses[m["id"]]["status"] == "taken")
        pending = meds.pending_today()
        ui.info(f"{taken} of {len(scheduled)} doses marked taken.")
        if pending:
            names = ", ".join(f"{m['name']} ({m['slot_time']})" for m in pending[:4])
            ui.warn("Due and not marked: " + names +
                    (f" +{len(pending) - 4} more" if len(pending) > 4 else ""))
        elif taken == len(scheduled):
            ui.ok("All done for today.")

    missed = _recent_missed(3)
    if missed:
        print()
        ui.warn(f"{missed} dose(s) went unmarked in the last 3 days -- "
                "open the checklist and pick the date to fill them in.")


def _age(stamp):
    try:
        delta = datetime.now() - datetime.strptime(stamp, "%Y-%m-%d %H:%M")
    except ValueError:
        return stamp
    mins = int(delta.total_seconds() // 60)
    if mins < 60:
        return f"{max(mins, 0)} min ago"
    if mins < 60 * 36:
        return f"{mins // 60} hr ago"
    return f"{mins // 1440} days ago"


def _recent_missed(days):
    total = 0
    for day in _days_back(days + 1)[:-1]:  # exclude today
        doses = meds.dose_map(day)
        total += sum(1 for m in meds.scheduled_for(day) if m["id"] not in doses)
    return total


# --- day view ---------------------------------------------------------------

def day_report(day=None):
    day = day or db.today_str()
    ui.header("Day report", ui.pretty_day(day))
    print()
    print(ui.bold("  Readings"))
    ui.rule()
    vitals.show_rows(vitals.on_day(day))

    print()
    print(ui.bold("  Medicines"))
    ui.rule()
    scheduled = meds.scheduled_for(day)
    if not scheduled:
        ui.info(ui.dim("None scheduled."))
    else:
        doses = meds.dose_map(day)
        rows = []
        for m in scheduled:
            dose = doses.get(m["id"])
            label, level = meds.dose_state(m, dose, day)
            rows.append([m["slot_time"], m["name"], m["dose"] or "-",
                         meds._paint(level, label), (dose["note"] if dose else "") or ""])
        ui.table(["Time", "Medicine", "Dose", "Status", "Note"], rows)


# --- history ----------------------------------------------------------------

def history():
    while True:
        choice = ui.menu(
            "History and reports",
            [("1", "Today at a glance"),
             ("2", "Pick a day"),
             ("3", "Readings -- last 7 days"),
             ("4", "Readings -- last 30 days"),
             ("5", "Medicine adherence"),
             ("6", "Out-of-range readings"),
             ("7", "Delete a reading")],
        )
        try:
            if choice == "0":
                return
            if choice == "1":
                day_report()
            elif choice == "2":
                day_report(ui.ask_day("Which date"))
            elif choice == "3":
                _readings_since(7)
            elif choice == "4":
                _readings_since(30)
            elif choice == "5":
                adherence()
            elif choice == "6":
                out_of_range()
            elif choice == "7":
                vitals.delete_reading()
        except ui.Cancelled:
            ui.info(ui.dim("Cancelled."))
        ui.pause()


def _readings_since(days):
    since = (date.today() - timedelta(days=days - 1)).isoformat()
    ui.header(f"Readings -- last {days} days", f"since {since}")
    rows = vitals.recent(limit=500, since=since)
    print()
    vitals.show_rows(rows)
    if rows:
        print()
        _averages(rows)


def _averages(rows):
    print(ui.bold("  Averages over this period"))
    ui.rule()
    out = []
    bp = [r for r in rows if r["kind"] == "bp"]
    if bp:
        out.append(["Blood pressure",
                    f"{sum(r['v1'] for r in bp) / len(bp):.0f}/"
                    f"{sum(r['v2'] for r in bp) / len(bp):.0f} mmHg",
                    f"{len(bp)} readings"])
    for tag in ("fasting", "post-meal", "random"):
        s = [r for r in rows if r["kind"] == "sugar" and r["tag"] == tag]
        if s:
            out.append([f"Sugar ({tag})", f"{sum(r['v1'] for r in s) / len(s):.0f} mg/dL",
                        f"{len(s)} readings"])
    ox = [r for r in rows if r["kind"] == "spo2"]
    if ox:
        out.append(["Oxygen", f"{sum(r['v1'] for r in ox) / len(ox):.0f}% "
                              f"(lowest {min(r['v1'] for r in ox):.0f}%)",
                    f"{len(ox)} readings"])
    ui.table(["", "Average", "Count"], out)


def out_of_range(days=30):
    since = (date.today() - timedelta(days=days - 1)).isoformat()
    ui.header(f"Out-of-range readings -- last {days} days")
    rows = [r for r in vitals.recent(limit=1000, since=since)
            if vitals.describe(r)[1] != "ok"]
    print()
    if not rows:
        ui.ok("Everything recorded was within your target bands.")
        return
    vitals.show_rows(rows)
    print()
    ui.info(ui.dim("Targets are editable under Settings. Follow the doctor's numbers, "
                   "not these defaults."))


def adherence(days=14):
    since_days = _days_back(days)
    ui.header(f"Medicine adherence -- last {days} days",
              f"{since_days[0]} to {since_days[-1]}")
    per_med = {}
    day_rows = []
    for day in since_days:
        scheduled = meds.scheduled_for(day)
        doses = meds.dose_map(day)
        taken = 0
        for m in scheduled:
            stat = per_med.setdefault(m["id"], {"name": m["name"], "time": m["slot_time"],
                                                "sched": 0, "taken": 0, "missed": 0})
            stat["sched"] += 1
            dose = doses.get(m["id"])
            if dose and dose["status"] == "taken":
                stat["taken"] += 1
                taken += 1
            elif dose is None and day <= db.today_str():
                stat["missed"] += 1
        if scheduled:
            pct = 100 * taken / len(scheduled)
            bar = "#" * int(round(pct / 10)) + "." * (10 - int(round(pct / 10)))
            colour = ui.green if pct >= 90 else (ui.yellow if pct >= 60 else ui.red)
            day_rows.append([day[5:], f"{taken}/{len(scheduled)}", colour(bar),
                             colour(f"{pct:.0f}%")])
    print()
    if not day_rows:
        ui.info(ui.dim("No medicines were scheduled in this period."))
        return
    ui.table(["Day", "Taken", "", "%"], day_rows)

    print()
    print(ui.bold("  Per medicine"))
    ui.rule()
    rows = []
    for stat in sorted(per_med.values(), key=lambda s: s["time"]):
        pct = 100 * stat["taken"] / stat["sched"] if stat["sched"] else 0
        colour = ui.green if pct >= 90 else (ui.yellow if pct >= 60 else ui.red)
        rows.append([stat["time"], stat["name"], f"{stat['taken']}/{stat['sched']}",
                     colour(f"{pct:.0f}%"),
                     ui.red(str(stat["missed"])) if stat["missed"] else "0"])
    ui.table(["Time", "Medicine", "Taken", "%", "Unmarked"], rows)
    total_s = sum(s["sched"] for s in per_med.values())
    total_t = sum(s["taken"] for s in per_med.values())
    print()
    if total_s:
        ui.info(ui.bold(f"Overall: {total_t}/{total_s} doses "
                        f"({100 * total_t / total_s:.0f}%)"))


# --- export -----------------------------------------------------------------

def export():
    ui.section("Export to CSV")
    os.makedirs(EXPORT_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")

    vpath = os.path.join(EXPORT_DIR, f"readings-{stamp}.csv")
    with open(vpath, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "time", "type", "value_1", "value_2", "pulse",
                    "tag", "status", "remarks"])
        for r in db.q("SELECT * FROM readings ORDER BY taken_at"):
            text, level, note = vitals.describe(r)
            day, time_str = r["taken_at"].split(" ")
            w.writerow([day, time_str, vitals.KINDS[r["kind"]], r["v1"], r["v2"], r["v3"],
                        r["tag"] or "", f"{level}: {note}" if note else level,
                        r["remarks"] or ""])

    mpath = os.path.join(EXPORT_DIR, f"medicines-{stamp}.csv")
    with open(mpath, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "time", "medicine", "dose", "status", "marked_at", "note"])
        rows = db.q("SELECT MIN(dose_date) a, MAX(dose_date) b FROM doses")[0]
        start = rows["a"] or db.today_str()
        end = max(rows["b"] or db.today_str(), db.today_str())
        day = date.fromisoformat(start)
        last = date.fromisoformat(end)
        while day <= last:
            key = day.isoformat()
            doses = meds.dose_map(key)
            for m in meds.scheduled_for(key):
                dose = doses.get(m["id"])
                label, _ = meds.dose_state(m, dose, key)
                w.writerow([key, m["slot_time"], m["name"], m["dose"] or "",
                            dose["status"] if dose else "not marked",
                            dose["marked_at"] if dose else "",
                            (dose["note"] if dose else "") or ""])
            day += timedelta(days=1)

    ui.ok("Written:")
    ui.info(ui.dim("  " + vpath))
    ui.info(ui.dim("  " + mpath))
    ui.info("Open either one in Excel, or print it to carry to the next appointment.")
