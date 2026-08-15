"""BP, blood sugar and SpO2 logging, with reference-band flagging."""

from . import db, ui

KINDS = {"bp": "Blood pressure", "sugar": "Blood sugar", "spo2": "Oxygen (SpO2)"}
SHORT = {"bp": "BP", "sugar": "Sugar", "spo2": "SpO2"}
SUGAR_TAGS = {
    "1": ("fasting", "Fasting / before meal"),
    "2": ("post-meal", "Post-meal (about 2 hrs after)"),
    "3": ("random", "Random"),
}


# --- interpretation ---------------------------------------------------------

def flag_bp(sys_v, dia_v):
    """Returns (level, note) where level is 'ok' | 'watch' | 'alert'."""
    hi_s, lo_s = db.get_num("bp_sys_high"), db.get_num("bp_sys_low")
    hi_d, lo_d = db.get_num("bp_dia_high"), db.get_num("bp_dia_low")
    if sys_v >= hi_s + 40 or dia_v >= hi_d + 30:
        return "alert", "very high"
    if sys_v < lo_s - 10 or dia_v < lo_d - 10:
        return "alert", "very low"
    if sys_v >= hi_s or dia_v >= hi_d:
        return "watch", "above target"
    if sys_v < lo_s or dia_v < lo_d:
        return "watch", "below target"
    return "ok", "in range"


def flag_sugar(value, tag):
    if tag == "fasting":
        hi, lo = db.get_num("sugar_fasting_high"), db.get_num("sugar_fasting_low")
    else:
        hi, lo = db.get_num("sugar_post_high"), db.get_num("sugar_post_low")
    if value < 70 or value >= 300:
        return "alert", "very low" if value < 70 else "very high"
    if value >= hi:
        return "watch", "above target"
    if value < lo:
        return "watch", "below target"
    return "ok", "in range"


def flag_spo2(value):
    low, alert = db.get_num("spo2_low"), db.get_num("spo2_alert")
    if value < alert:
        return "alert", "low oxygen"
    if value < low:
        return "watch", "below target"
    return "ok", "in range"


def flag_pulse(value):
    if value is None:
        return "ok", ""
    hi, lo = db.get_num("pulse_high"), db.get_num("pulse_low")
    if value >= hi + 20 or value < lo - 10:
        return "alert", "pulse off"
    if value >= hi or value < lo:
        return "watch", "pulse off"
    return "ok", ""


def worst(*levels):
    order = {"ok": 0, "watch": 1, "alert": 2}
    return max(levels, key=lambda lv: order.get(lv, 0))


def paint(level, text):
    if level == "alert":
        return ui.red(text)
    if level == "watch":
        return ui.yellow(text)
    return ui.green(text)


def describe(row):
    """Returns (value_string, level, note) for a reading row."""
    kind = row["kind"]
    if kind == "bp":
        level, note = flag_bp(row["v1"], row["v2"])
        plevel, pnote = flag_pulse(row["v3"])
        text = f"{int(row['v1'])}/{int(row['v2'])} mmHg"
        if row["v3"]:
            text += f", pulse {int(row['v3'])}"
            if pnote:
                note = f"{note}, {pnote}"
        return text, worst(level, plevel), note
    if kind == "sugar":
        level, note = flag_sugar(row["v1"], row["tag"])
        return f"{row['v1']:.0f} mg/dL ({row['tag']})", level, note
    level, note = flag_spo2(row["v1"])
    text = f"{row['v1']:.0f}%"
    if row["v2"]:
        text += f", pulse {int(row['v2'])}"
    return text, level, note


# --- writing ----------------------------------------------------------------

def add(kind, taken_at, v1, v2=None, v3=None, tag=None, remarks=""):
    db.run(
        "INSERT INTO readings(kind, taken_at, v1, v2, v3, tag, remarks, logged_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (kind, taken_at, v1, v2, v3, tag, remarks, db.now_stamp()),
    )


def log_bp():
    ui.section("Log blood pressure")
    when = ui.ask_when()
    sys_v = ui.ask_num("Systolic (upper)", lo=60, hi=260, integer=True)
    dia_v = ui.ask_num("Diastolic (lower)", lo=30, hi=180, integer=True)
    if dia_v >= sys_v:
        ui.warn("Lower reading is not below the upper one -- check you did not swap them.")
        if not ui.confirm("Save as entered?", default=False):
            return
    pulse = ui.ask_num("Pulse (blank to skip)", lo=25, hi=220, allow_blank=True, integer=True)
    remarks = ui.ask("Remarks (blank to skip)", allow_blank=True)
    add("bp", when, sys_v, dia_v, pulse, remarks=remarks)
    level, note = flag_bp(sys_v, dia_v)
    ui.ok(f"Saved {sys_v}/{dia_v} at {when} -- " + paint(level, note))
    _advise(level)


def log_sugar():
    ui.section("Log blood sugar")
    when = ui.ask_when()
    print()
    for key, (_, label) in SUGAR_TAGS.items():
        print(f"   {ui.cyan(key)}) {label}")
    print()
    choice = ui.ask("Reading type", default="3")
    tag = SUGAR_TAGS.get(choice, SUGAR_TAGS["3"])[0]
    value = ui.ask_num("Value (mg/dL)", lo=30, hi=600)
    remarks = ui.ask("Remarks (blank to skip)", allow_blank=True)
    add("sugar", when, value, tag=tag, remarks=remarks)
    level, note = flag_sugar(value, tag)
    ui.ok(f"Saved {value:.0f} mg/dL ({tag}) at {when} -- " + paint(level, note))
    _advise(level)


def log_spo2():
    ui.section("Log oxygen (SpO2)")
    when = ui.ask_when()
    value = ui.ask_num("SpO2 %", lo=50, hi=100, integer=True)
    pulse = ui.ask_num("Pulse from the meter (blank to skip)", lo=25, hi=220,
                       allow_blank=True, integer=True)
    remarks = ui.ask("Remarks (blank to skip)", allow_blank=True)
    add("spo2", when, value, pulse, remarks=remarks)
    level, note = flag_spo2(value)
    ui.ok(f"Saved {value}% at {when} -- " + paint(level, note))
    _advise(level)


def log_all():
    """Sit down once and record everything -- the usual post-op routine."""
    ui.section("Full check (BP + sugar + oxygen)")
    ui.info(ui.dim("Skip any part by leaving its first value blank."))
    when = ui.ask_when()
    remarks = ui.ask("Remarks for this round (blank to skip)", allow_blank=True)

    sys_v = ui.ask_num("Systolic (blank to skip BP)", lo=60, hi=260,
                       allow_blank=True, integer=True)
    if sys_v is not None:
        dia_v = ui.ask_num("Diastolic", lo=30, hi=180, integer=True)
        pulse = ui.ask_num("Pulse (blank to skip)", lo=25, hi=220,
                           allow_blank=True, integer=True)
        add("bp", when, sys_v, dia_v, pulse, remarks=remarks)
        level, note = flag_bp(sys_v, dia_v)
        ui.ok(f"BP {sys_v}/{dia_v} -- " + paint(level, note))

    value = ui.ask_num("Blood sugar mg/dL (blank to skip)", lo=30, hi=600, allow_blank=True)
    if value is not None:
        print()
        for key, (_, label) in SUGAR_TAGS.items():
            print(f"   {ui.cyan(key)}) {label}")
        print()
        tag = SUGAR_TAGS.get(ui.ask("Reading type", default="3"), SUGAR_TAGS["3"])[0]
        add("sugar", when, value, tag=tag, remarks=remarks)
        level, note = flag_sugar(value, tag)
        ui.ok(f"Sugar {value:.0f} mg/dL ({tag}) -- " + paint(level, note))

    spo2 = ui.ask_num("SpO2 % (blank to skip)", lo=50, hi=100, allow_blank=True, integer=True)
    if spo2 is not None:
        add("spo2", when, spo2, remarks=remarks)
        level, note = flag_spo2(spo2)
        ui.ok(f"SpO2 {spo2}% -- " + paint(level, note))
        _advise(level)


def _advise(level):
    if level == "alert":
        ui.warn("That reading is well outside the usual band. Recheck it, and if it holds, "
                "call the doctor or hospital.")


# --- reading / editing ------------------------------------------------------

def recent(kind=None, limit=20, since=None):
    sql = "SELECT * FROM readings WHERE 1=1"
    params = []
    if kind:
        sql += " AND kind = ?"
        params.append(kind)
    if since:
        sql += " AND taken_at >= ?"
        params.append(since + " 00:00")
    sql += " ORDER BY taken_at DESC, id DESC LIMIT ?"
    params.append(limit)
    return db.q(sql, params)


def on_day(day):
    return db.q(
        "SELECT * FROM readings WHERE taken_at LIKE ? ORDER BY taken_at, id",
        (day + "%",),
    )


def latest(kind):
    return db.one(
        "SELECT * FROM readings WHERE kind = ? ORDER BY taken_at DESC, id DESC LIMIT 1",
        (kind,),
    )


def show_rows(rows, show_kind=True):
    headers = (["When"] + (["Type"] if show_kind else []) + ["Reading", "Status", "Remarks"])
    out = []
    for r in rows:
        text, level, note = describe(r)
        row = [r["taken_at"]]
        if show_kind:
            row.append(SHORT[r["kind"]])
        row += [text, paint(level, note or "-"), (r["remarks"] or "")[:28]]
        out.append(row)
    ui.table(headers, out)


def delete_reading():
    ui.section("Delete a reading")
    rows = recent(limit=15)
    if not rows:
        ui.info(ui.dim("Nothing recorded yet."))
        return
    out = []
    for r in rows:
        text, level, note = describe(r)
        out.append([r["id"], r["taken_at"], SHORT[r["kind"]], text])
    ui.table(["ID", "When", "Type", "Reading"], out)
    print()
    rid = ui.ask_num("ID to delete", integer=True)
    row = db.one("SELECT * FROM readings WHERE id = ?", (rid,))
    if not row:
        ui.err("No reading with that ID.")
        return
    text, _, _ = describe(row)
    if ui.confirm(f"Delete {text} from {row['taken_at']}?", default=False):
        db.run("DELETE FROM readings WHERE id = ?", (rid,))
        ui.ok("Deleted.")
