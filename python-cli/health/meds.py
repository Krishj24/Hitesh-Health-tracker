"""Medicine schedule and the daily taken/not-taken checklist."""

from datetime import date, datetime

from . import db, ui

COMMON_SLOTS = [
    ("1", "Morning", "08:00"),
    ("2", "Afternoon", "14:00"),
    ("3", "Evening", "18:00"),
    ("4", "Night", "21:00"),
]


# --- schedule ---------------------------------------------------------------

def scheduled_for(day):
    """Active meds whose date window covers `day`, in time order."""
    return db.q(
        "SELECT * FROM meds WHERE active = 1 AND start_date <= ? "
        "AND (end_date IS NULL OR end_date >= ?) "
        "ORDER BY slot_time, name",
        (day, day),
    )


def all_meds(include_stopped=True):
    sql = "SELECT * FROM meds"
    if not include_stopped:
        sql += " WHERE active = 1"
    return db.q(sql + " ORDER BY active DESC, slot_time, name")


def dose_map(day):
    rows = db.q("SELECT * FROM doses WHERE dose_date = ?", (day,))
    return {r["med_id"]: r for r in rows}


def mark(med_id, day, status, note=""):
    db.run(
        "INSERT INTO doses(med_id, dose_date, status, marked_at, note) VALUES (?,?,?,?,?) "
        "ON CONFLICT(med_id, dose_date) DO UPDATE SET "
        "status = excluded.status, marked_at = excluded.marked_at, note = excluded.note",
        (med_id, day, status, db.now_stamp(), note),
    )


def unmark(med_id, day):
    db.run("DELETE FROM doses WHERE med_id = ? AND dose_date = ?", (med_id, day))


def dose_state(med, dose, day):
    """Returns (label, level) for one med on one day."""
    if dose is None:
        if day < db.today_str():
            return "MISSED", "alert"
        if day > db.today_str():
            return "upcoming", "ok"
        if datetime.now().strftime("%H:%M") > med["slot_time"]:
            return "DUE", "watch"
        return "pending", "ok"
    if dose["status"] == "taken":
        return "taken " + dose["marked_at"][11:], "done"
    return "skipped", "watch"


def _paint(level, text):
    if level == "done":
        return ui.green(text)
    if level == "alert":
        return ui.red(text)
    if level == "watch":
        return ui.yellow(text)
    return ui.dim(text)


def pending_today():
    """Meds due now or earlier today that are still unmarked."""
    day = db.today_str()
    doses = dose_map(day)
    now = datetime.now().strftime("%H:%M")
    return [m for m in scheduled_for(day)
            if m["id"] not in doses and m["slot_time"] <= now]


# --- checklist screen -------------------------------------------------------

def checklist(day=None):
    """The daily list: view and toggle what was taken."""
    day = day or db.today_str()
    while True:
        meds = scheduled_for(day)
        doses = dose_map(day)
        ui.header("Medicine checklist", ui.pretty_day(day))
        if not meds:
            print()
            ui.info(ui.dim("No medicines scheduled for this date."))
            ui.info(ui.dim("Add them under 'Manage medicine list' on the main menu."))
        else:
            print()
            rows = []
            current_slot = None
            for i, m in enumerate(meds, 1):
                label, level = dose_state(m, doses.get(m["id"]), day)
                box = "[x]" if level == "done" else ("[-]" if label == "skipped" else "[ ]")
                slot = f"{m['slot_time']} {m['slot_label']}"
                rows.append([
                    str(i),
                    _paint(level, box),
                    slot if slot != current_slot else "",
                    m["name"] + (f" ({m['dose']})" if m["dose"] else ""),
                    _paint(level, label),
                ])
                current_slot = slot
            ui.table(["#", "", "Time", "Medicine", "Status"], rows)
            done = sum(1 for m in meds if doses.get(m["id"], {}) and
                       doses[m["id"]]["status"] == "taken")
            print()
            ui.info(f"{done} of {len(meds)} taken.")

        print()
        print(ui.dim("  Type numbers to mark TAKEN (e.g. 1 3 4), or 'all'."))
        print(ui.dim("  s <n> = skipped   c <n> = clear mark   n <n> = add a note"))
        print(ui.dim("  d = change date    0 = back"))
        print()
        try:
            cmd = ui.ask("Action", allow_blank=True).lower()
        except ui.Cancelled:
            return
        if cmd in ("0", ""):
            return
        if cmd == "d":
            day = ui.ask_day("Show which date")
            continue
        if not meds:
            continue
        _apply(cmd, meds, day)


def _apply(cmd, meds, day):
    parts = cmd.split()
    verb, args = "take", parts
    if parts[0] in ("s", "c", "n"):
        verb, args = {"s": "skip", "c": "clear", "n": "note"}[parts[0]], parts[1:]
    if args and args[0] == "all":
        picks = list(range(1, len(meds) + 1))
    else:
        picks = []
        for a in args:
            if a.isdigit() and 1 <= int(a) <= len(meds):
                picks.append(int(a))
            else:
                ui.err(f"'{a}' is not one of the numbers listed.")
                ui.pause()
                return
    if not picks:
        return
    if verb == "note":
        for i in picks:
            note = ui.ask(f"Note for {meds[i - 1]['name']}", allow_blank=True)
            row = db.one("SELECT * FROM doses WHERE med_id = ? AND dose_date = ?",
                         (meds[i - 1]["id"], day))
            mark(meds[i - 1]["id"], day, row["status"] if row else "taken", note)
        return
    for i in picks:
        med = meds[i - 1]
        if verb == "clear":
            unmark(med["id"], day)
        else:
            mark(med["id"], day, "taken" if verb == "take" else "skipped")


# --- managing the list ------------------------------------------------------

def manage():
    while True:
        choice = ui.menu(
            "Manage medicine list",
            [("1", "Add a medicine"),
             ("2", "Edit a medicine"),
             ("3", "Stop / resume a medicine"),
             ("4", "Delete a medicine (and its history)"),
             ("5", "View full list")],
        )
        try:
            if choice == "0":
                return
            if choice == "1":
                add_med()
            elif choice == "2":
                edit_med()
            elif choice == "3":
                toggle_med()
            elif choice == "4":
                delete_med()
            elif choice == "5":
                show_list()
        except ui.Cancelled:
            ui.info(ui.dim("Cancelled."))
        ui.pause()


def show_list():
    ui.section("All medicines")
    meds = all_meds()
    if not meds:
        ui.info(ui.dim("No medicines added yet."))
        return
    rows = []
    for m in meds:
        window = m["start_date"] + " -> " + (m["end_date"] or "ongoing")
        status = ui.green("active") if m["active"] else ui.dim("stopped")
        if m["active"] and m["end_date"] and m["end_date"] < db.today_str():
            status = ui.dim("finished")
        rows.append([m["id"], f"{m['slot_time']} {m['slot_label']}", m["name"],
                     m["dose"] or "-", window, status, (m["notes"] or "")[:20]])
    ui.table(["ID", "Time", "Medicine", "Dose", "Course", "Status", "Notes"], rows)


def _pick_slot():
    print()
    for key, label, time_str in COMMON_SLOTS:
        print(f"   {ui.cyan(key)}) {label} ({time_str})")
    print(f"   {ui.cyan('5')}) Something else")
    print()
    choice = ui.ask("Time slot", default="1")
    for key, label, time_str in COMMON_SLOTS:
        if choice == key:
            return label, ui.ask_time("Time for this dose", default=time_str)
    label = ui.ask("Slot name (e.g. Bedtime)")
    return label, ui.ask_time("Time for this dose", default="12:00")


def add_med():
    ui.section("Add a medicine")
    ui.info(ui.dim("One entry per dose time. A twice-a-day medicine gets two entries."))
    name = ui.ask("Medicine name")
    dose = ui.ask("Dose (e.g. 1 tablet, 500 mg)", allow_blank=True)
    label, time_str = _pick_slot()
    start = ui.ask_day("Start date")
    days = ui.ask_num("Course length in days (blank = ongoing)", lo=1, hi=3650,
                      allow_blank=True, integer=True)
    end = None
    if days:
        end = (date.fromisoformat(start).toordinal() + days - 1)
        end = date.fromordinal(end).isoformat()
    notes = ui.ask("Notes (e.g. after food)", allow_blank=True)
    db.run(
        "INSERT INTO meds(name, dose, slot_label, slot_time, start_date, end_date, "
        "notes, active, created_at) VALUES (?,?,?,?,?,?,?,1,?)",
        (name, dose, label, time_str, start, end, notes, db.now_stamp()),
    )
    ui.ok(f"Added {name} at {time_str} ({label}), " +
          (f"until {end}." if end else "ongoing."))


def _pick_med(prompt="Medicine ID", include_stopped=True):
    show_list()
    meds = all_meds(include_stopped)
    if not meds:
        return None
    print()
    mid = ui.ask_num(prompt, integer=True)
    med = db.one("SELECT * FROM meds WHERE id = ?", (mid,))
    if not med:
        ui.err("No medicine with that ID.")
        return None
    return med


def edit_med():
    ui.section("Edit a medicine")
    med = _pick_med()
    if not med:
        return
    ui.info(ui.dim("Press Enter to keep the current value."))
    name = ui.ask("Name", default=med["name"])
    dose = ui.ask("Dose", default=med["dose"] or "-", allow_blank=True)
    label = ui.ask("Slot name", default=med["slot_label"])
    time_str = ui.ask_time("Time", default=med["slot_time"])
    start = ui.ask_day("Start date") if ui.confirm(
        f"Change start date (now {med['start_date']})?", default=False) else med["start_date"]
    end = med["end_date"]
    if ui.confirm(f"Change end date (now {end or 'ongoing'})?", default=False):
        end = ui.ask_day("End date (blank = today, or type a date)") \
            if ui.confirm("Set an end date? (No = ongoing)", default=True) else None
    db.run(
        "UPDATE meds SET name=?, dose=?, slot_label=?, slot_time=?, start_date=?, end_date=? "
        "WHERE id=?",
        (name, "" if dose == "-" else dose, label, time_str, start, end, med["id"]),
    )
    ui.ok("Updated.")


def toggle_med():
    ui.section("Stop / resume a medicine")
    ui.info(ui.dim("Stopping keeps the past record but drops it from future checklists."))
    med = _pick_med()
    if not med:
        return
    new_state = 0 if med["active"] else 1
    db.run("UPDATE meds SET active = ? WHERE id = ?", (new_state, med["id"]))
    ui.ok(f"{med['name']} is now " + ("active." if new_state else "stopped."))


def delete_med():
    ui.section("Delete a medicine")
    med = _pick_med()
    if not med:
        return
    count = db.one("SELECT COUNT(*) c FROM doses WHERE med_id = ?", (med["id"],))["c"]
    if count:
        ui.warn(f"{med['name']} has {count} day(s) of history that would be erased.")
        ui.info(ui.dim("If the course simply ended, use 'Stop' instead -- it keeps the record."))
    if ui.confirm(f"Permanently delete {med['name']}?", default=False):
        db.run("DELETE FROM doses WHERE med_id = ?", (med["id"],))
        db.run("DELETE FROM meds WHERE id = ?", (med["id"],))
        ui.ok("Deleted.")
