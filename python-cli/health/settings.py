"""Patient details and the target bands used to flag readings."""

from . import db, ui

TARGETS = [
    ("bp_sys_high", "BP systolic -- flag at or above", "mmHg"),
    ("bp_sys_low", "BP systolic -- flag below", "mmHg"),
    ("bp_dia_high", "BP diastolic -- flag at or above", "mmHg"),
    ("bp_dia_low", "BP diastolic -- flag below", "mmHg"),
    ("sugar_fasting_high", "Fasting sugar -- flag at or above", "mg/dL"),
    ("sugar_fasting_low", "Fasting sugar -- flag below", "mg/dL"),
    ("sugar_post_high", "Post-meal sugar -- flag at or above", "mg/dL"),
    ("sugar_post_low", "Post-meal sugar -- flag below", "mg/dL"),
    ("spo2_low", "SpO2 -- flag below", "%"),
    ("spo2_alert", "SpO2 -- alert below", "%"),
    ("pulse_high", "Pulse -- flag at or above", "bpm"),
    ("pulse_low", "Pulse -- flag below", "bpm"),
]


def screen():
    while True:
        choice = ui.menu(
            "Settings",
            [("1", "Patient name and surgery date"),
             ("2", "Target ranges used for flagging"),
             ("3", "Where is my data stored?")],
        )
        try:
            if choice == "0":
                return
            if choice == "1":
                _patient()
            elif choice == "2":
                _targets()
            elif choice == "3":
                _storage()
        except ui.Cancelled:
            ui.info(ui.dim("Cancelled."))
        ui.pause()


def _patient():
    ui.section("Patient details")
    name = ui.ask("Name shown on the dashboard", default=db.get_setting("patient_name"))
    db.set_setting("patient_name", name)
    current = db.get_setting("surgery_date")
    if ui.confirm(f"Set surgery date (now {current or 'not set'})?",
                  default=not current):
        db.set_setting("surgery_date", ui.ask_day("Surgery date"))
    ui.ok("Saved.")


def _targets():
    ui.section("Target ranges")
    ui.warn("These are general reference bands, not medical advice.")
    ui.info(ui.dim("If the doctor gave different targets, enter those -- flags follow "
                   "whatever is set here."))
    print()
    rows = [[label, f"{db.get_num(key):.0f}", unit] for key, label, unit in TARGETS]
    ui.table(["Setting", "Value", "Unit"], rows)
    print()
    if not ui.confirm("Change these values?", default=False):
        return
    ui.info(ui.dim("Press Enter to keep each current value."))
    for key, label, unit in TARGETS:
        val = ui.ask_num(f"{label} ({unit})", default=f"{db.get_num(key):.0f}")
        db.set_setting(key, int(val))
    ui.ok("Targets updated.")


def _storage():
    ui.section("Data location")
    ui.info("Database: " + db.DB_PATH)
    ui.info(ui.dim("Everything stays on this computer. Nothing is uploaded anywhere."))
    ui.info(ui.dim("To back up, copy that one file. To move to another machine, "
                   "copy it into the same folder there."))
    counts = db.one(
        "SELECT (SELECT COUNT(*) FROM readings) r, (SELECT COUNT(*) FROM meds) m, "
        "(SELECT COUNT(*) FROM doses) d"
    )
    print()
    ui.info(f"{counts['r']} readings, {counts['m']} medicines, {counts['d']} dose marks.")
