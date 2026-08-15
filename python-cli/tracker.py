"""Post-op care terminal -- daily vitals log and medicine checklist.

Run with:  python tracker.py
"""

import sys

from health import db, meds, reports, settings, ui, vitals


def vitals_menu():
    while True:
        choice = ui.menu(
            "Log readings",
            [("1", "Full check (BP + sugar + oxygen)"),
             ("2", "Blood pressure only"),
             ("3", "Blood sugar only"),
             ("4", "Oxygen (SpO2) only"),
             ("5", "See today's readings")],
            subtitle="Type q at any prompt to cancel",
        )
        try:
            if choice == "0":
                return
            if choice == "1":
                vitals.log_all()
            elif choice == "2":
                vitals.log_bp()
            elif choice == "3":
                vitals.log_sugar()
            elif choice == "4":
                vitals.log_spo2()
            elif choice == "5":
                ui.section("Today's readings")
                vitals.show_rows(vitals.on_day(db.today_str()))
        except ui.Cancelled:
            ui.info(ui.dim("Cancelled -- nothing saved."))
        ui.pause()


def main():
    db.connect()
    while True:
        ui.clear()
        try:
            reports.dashboard()
        except Exception as exc:  # never let a display glitch block data entry
            ui.err(f"Could not draw the dashboard: {exc}")
        print()
        print(f"   {ui.cyan('1')}) Log readings (BP / sugar / oxygen)")
        print(f"   {ui.cyan('2')}) Medicine checklist")
        print(f"   {ui.cyan('3')}) Manage medicine list")
        print(f"   {ui.cyan('4')}) History and reports")
        print(f"   {ui.cyan('5')}) Export to CSV")
        print(f"   {ui.cyan('6')}) Settings")
        print(f"   {ui.cyan('0')}) Exit")
        print()
        try:
            choice = ui.ask("Choose", allow_blank=True)
        except ui.Cancelled:
            choice = "0"

        if choice in ("0", "", "q"):
            print(ui.dim("\n  Take care. Data saved.\n"))
            return
        try:
            if choice == "1":
                vitals_menu()
            elif choice == "2":
                meds.checklist()
            elif choice == "3":
                meds.manage()
            elif choice == "4":
                reports.history()
            elif choice == "5":
                reports.export()
                ui.pause()
            elif choice == "6":
                settings.screen()
            else:
                ui.err("Not an option.")
                ui.pause()
        except ui.Cancelled:
            pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(ui.dim("\n\n  Stopped. Data saved.\n"))
        sys.exit(0)
