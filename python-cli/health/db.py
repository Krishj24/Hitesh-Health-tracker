"""SQLite storage layer. One file, no external dependencies."""

import os
import sqlite3
from datetime import date, datetime

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("HEALTH_DB") or os.path.join(APP_DIR, "data", "health.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    kind      TEXT NOT NULL,              -- 'bp' | 'sugar' | 'spo2'
    taken_at  TEXT NOT NULL,              -- 'YYYY-MM-DD HH:MM'
    v1        REAL,                       -- bp: systolic | sugar: mg/dL | spo2: %
    v2        REAL,                       -- bp: diastolic                | spo2: pulse
    v3        REAL,                       -- bp: pulse
    tag       TEXT,                       -- sugar: fasting/post-meal/random
    remarks   TEXT,
    logged_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_kind_time ON readings(kind, taken_at);

CREATE TABLE IF NOT EXISTS meds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    dose        TEXT,                     -- '1 tablet', '500 mg'
    slot_label  TEXT NOT NULL,            -- 'Morning', 'Night', ...
    slot_time   TEXT NOT NULL,            -- 'HH:MM'
    start_date  TEXT NOT NULL,            -- 'YYYY-MM-DD'
    end_date    TEXT,                     -- 'YYYY-MM-DD' or NULL = ongoing
    notes       TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    med_id    INTEGER NOT NULL REFERENCES meds(id),
    dose_date TEXT NOT NULL,              -- 'YYYY-MM-DD'
    status    TEXT NOT NULL,              -- 'taken' | 'skipped'
    marked_at TEXT NOT NULL,
    note      TEXT,
    UNIQUE(med_id, dose_date)
);
CREATE INDEX IF NOT EXISTS idx_doses_date ON doses(dose_date);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

DEFAULT_SETTINGS = {
    "patient_name": "Patient",
    "surgery_date": "",
    # Reference bands. Editable in Settings -- your doctor's targets win.
    "bp_sys_high": "140",
    "bp_sys_low": "90",
    "bp_dia_high": "90",
    "bp_dia_low": "60",
    "sugar_fasting_high": "130",
    "sugar_fasting_low": "70",
    "sugar_post_high": "180",
    "sugar_post_low": "70",
    "spo2_low": "94",
    "spo2_alert": "90",
    "pulse_high": "100",
    "pulse_low": "50",
}

_conn = None


def connect():
    """Open (and on first run, create) the database."""
    global _conn
    if _conn is not None:
        return _conn
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    _conn = sqlite3.connect(DB_PATH)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA foreign_keys = ON")
    _conn.executescript(SCHEMA)
    for key, value in DEFAULT_SETTINGS.items():
        _conn.execute(
            "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (key, value)
        )
    _conn.commit()
    return _conn


def q(sql, params=()):
    return connect().execute(sql, params).fetchall()


def one(sql, params=()):
    return connect().execute(sql, params).fetchone()


def run(sql, params=()):
    conn = connect()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur


def now_stamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def today_str():
    return date.today().isoformat()


# --- settings ---------------------------------------------------------------

def get_setting(key, default=None):
    row = one("SELECT value FROM settings WHERE key = ?", (key,))
    return row["value"] if row else (default if default is not None else DEFAULT_SETTINGS.get(key, ""))


def get_num(key):
    try:
        return float(get_setting(key))
    except (TypeError, ValueError):
        return float(DEFAULT_SETTINGS.get(key, 0) or 0)


def set_setting(key, value):
    run(
        "INSERT INTO settings(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )
