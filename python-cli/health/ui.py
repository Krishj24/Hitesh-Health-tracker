"""Terminal input/output helpers. ASCII only, so it renders on any console."""

import os
import re
import sys
from datetime import date, datetime, timedelta

WIDTH = 74

if os.name == "nt":  # ask Windows consoles to interpret ANSI escapes
    os.system("")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_COLOR = os.environ.get("NO_COLOR") is None and sys.stdout.isatty()


def _c(code, text):
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


def dim(t):
    return _c("2", t)


def bold(t):
    return _c("1", t)


def green(t):
    return _c("32", t)


def yellow(t):
    return _c("33", t)


def red(t):
    return _c("31", t)


def cyan(t):
    return _c("36", t)


class Cancelled(Exception):
    """Raised when the user types 'q' at a prompt."""


# --- output -----------------------------------------------------------------

def clear():
    os.system("cls" if os.name == "nt" else "clear")


def rule(char="-"):
    print(dim(char * WIDTH))


def header(title, subtitle=""):
    print()
    print(bold("=" * WIDTH))
    print(bold("  " + title))
    if subtitle:
        print(dim("  " + subtitle))
    print(bold("=" * WIDTH))


def section(title):
    print()
    print(bold(title))
    rule()


def info(msg):
    print("  " + msg)


def ok(msg):
    print(green("  [OK] ") + msg)


def warn(msg):
    print(yellow("  [!]  ") + msg)


def err(msg):
    print(red("  [X]  ") + msg)


def pause():
    try:
        input(dim("\n  Press Enter to continue..."))
    except (EOFError, KeyboardInterrupt):
        print()


def table(headers, rows, aligns=None):
    """Print a simple fixed-width table. Cells are pre-formatted strings."""
    if not rows:
        info(dim("(nothing recorded)"))
        return
    cols = len(headers)
    aligns = aligns or ["<"] * cols
    widths = [len(str(h)) for h in headers]
    for r in rows:
        for i in range(cols):
            widths[i] = max(widths[i], len(_plain(str(r[i]))))
    line = "  ".join(bold(str(h).ljust(widths[i])) for i, h in enumerate(headers))
    print("  " + line)
    print("  " + dim("-" * (sum(widths) + 2 * (cols - 1))))
    for r in rows:
        cells = []
        for i in range(cols):
            raw = str(r[i])
            pad = widths[i] - len(_plain(raw))
            cells.append(raw + " " * pad if aligns[i] == "<" else " " * pad + raw)
        print("  " + "  ".join(cells))


def _plain(text):
    return re.sub(r"\033\[[0-9;]*m", "", text)


# --- input ------------------------------------------------------------------

def _raw(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        raise Cancelled()
    except KeyboardInterrupt:
        print()
        raise Cancelled()


def ask(prompt, default=None, allow_blank=False):
    """Free text. 'q' cancels."""
    suffix = f" [{default}]" if default not in (None, "") else ""
    while True:
        val = _raw(f"  {prompt}{suffix}: ")
        if val.lower() == "q":
            raise Cancelled()
        if not val:
            if default not in (None, ""):
                return default
            if allow_blank:
                return ""
            err("Required. (q to cancel)")
            continue
        return val


def ask_num(prompt, lo=None, hi=None, default=None, allow_blank=False, integer=False):
    """Numeric input with a sanity range. Blank -> default/None."""
    while True:
        try:
            val = ask(prompt, default=default, allow_blank=True)
        except Cancelled:
            raise
        if val == "":
            if allow_blank:
                return None
            err("Required. (q to cancel)")
            continue
        try:
            num = float(val)
        except ValueError:
            err("Enter a number, e.g. 120")
            continue
        if lo is not None and num < lo or hi is not None and num > hi:
            err(f"Expected between {lo} and {hi}. Type it again if that reading is real.")
            if not confirm("Keep this value anyway?", default=False):
                continue
        return int(num) if integer else num


def confirm(prompt, default=True):
    hint = "Y/n" if default else "y/N"
    while True:
        val = _raw(f"  {prompt} [{hint}]: ").lower()
        if not val:
            return default
        if val in ("y", "yes"):
            return True
        if val in ("n", "no"):
            return False


def menu(title, options, subtitle="", back="Back"):
    """options: list of (key, label). Returns the chosen key ('0' = back)."""
    while True:
        header(title, subtitle)
        print()
        for key, label in options:
            print(f"   {cyan(key)}) {label}")
        print(f"   {cyan('0')}) {back}")
        print()
        choice = _raw("  Choose: ").lower()
        if choice in ("0", "q", ""):
            return "0"
        for key, _ in options:
            if choice == key.lower():
                return key
        err("Not an option.")
        pause()


# --- date / time parsing ----------------------------------------------------

def parse_when(text):
    """Parse a date+time. Returns 'YYYY-MM-DD HH:MM' or None."""
    text = (text or "").strip().lower()
    now = datetime.now()
    if text in ("", "now", "n"):
        return now.strftime("%Y-%m-%d %H:%M")
    formats = [
        "%Y-%m-%d %H:%M", "%Y-%m-%d %H%M", "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M",
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            if "%H" not in fmt:
                dt = dt.replace(hour=now.hour, minute=now.minute)
            return dt.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass
    for fmt in ("%H:%M", "%H%M"):  # time only -> today
        try:
            t = datetime.strptime(text, fmt)
            return now.replace(hour=t.hour, minute=t.minute).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass
    return None


def parse_day(text):
    """Parse a date. Returns 'YYYY-MM-DD' or None."""
    text = (text or "").strip().lower()
    today = date.today()
    if text in ("", "today", "t"):
        return today.isoformat()
    if text in ("yesterday", "y"):
        return (today - timedelta(days=1)).isoformat()
    if re.fullmatch(r"-\d+", text):  # -1 = yesterday, -3 = three days back
        return (today + timedelta(days=int(text))).isoformat()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%m", "%d/%m"):
        try:
            d = datetime.strptime(text, fmt).date()
            if "%Y" not in fmt:
                d = d.replace(year=today.year)
            return d.isoformat()
        except ValueError:
            pass
    return None


def ask_when(prompt="When", default_now=True):
    hint = "blank = now, or 'YYYY-MM-DD HH:MM' / 'HH:MM'"
    while True:
        val = ask(f"{prompt} ({hint})", allow_blank=True)
        stamp = parse_when(val if val else ("now" if default_now else ""))
        if stamp:
            return stamp
        err("Could not read that. Try 2026-08-15 08:30 or 08:30")


def ask_day(prompt="Date", default_today=True):
    hint = "blank = today, 'y' = yesterday, -2 = 2 days back, or YYYY-MM-DD"
    while True:
        val = ask(f"{prompt} ({hint})", allow_blank=True)
        day = parse_day(val if val else ("today" if default_today else ""))
        if day:
            return day
        err("Could not read that date.")


def ask_time(prompt, default="08:00"):
    while True:
        val = ask(prompt, default=default)
        for fmt in ("%H:%M", "%H%M", "%I:%M%p", "%I%p"):
            try:
                return datetime.strptime(val.upper().replace(" ", ""), fmt).strftime("%H:%M")
            except ValueError:
                pass
        err("Use 24-hour time, e.g. 08:00 or 21:30")


def pretty_day(day_str):
    d = date.fromisoformat(day_str)
    label = d.strftime("%a %d %b %Y")
    delta = (d - date.today()).days
    if delta == 0:
        return f"{label} (today)"
    if delta == -1:
        return f"{label} (yesterday)"
    return label
