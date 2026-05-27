from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator

DEFAULT_DATA_DIR = Path(os.getenv("DRP_DATA_DIR", Path.home() / ".drp"))
DB_PATH = DEFAULT_DATA_DIR / "drp.sqlite3"
BACKUP_DIR = DEFAULT_DATA_DIR / "backups"


def ensure_data_dir() -> None:
    DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def get_db_path() -> Path:
    ensure_data_dir()
    return DB_PATH


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def migrate() -> None:
    ensure_data_dir()
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_summary (
              name TEXT PRIMARY KEY,
              display_name TEXT NOT NULL DEFAULT '',
              cycle TEXT NOT NULL,
              defects INTEGER NOT NULL,
              teams INTEGER NOT NULL,
              similarity REAL,
              project_category TEXT,
              region TEXT,
              os TEXT,
              device_type TEXT,
              chipset_status TEXT,
              chipset_vendor TEXT,
              chipset_newness TEXT,
              pipeline TEXT,
              operators_json TEXT NOT NULL DEFAULT '[]',
              user_programs_json TEXT NOT NULL DEFAULT '[]',
              idh_vendor TEXT,
              fr_quantity REAL,
              mm REAL,
              support_sim TEXT,
              valid_start_date TEXT,
              valid_end_date TEXT,
              source TEXT NOT NULL DEFAULT 'history',
              updated_at TEXT NOT NULL
            )
            """
        )
        # Backward-compatible migration: add display_name if missing
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(project_summary)").fetchall()}
        if "display_name" not in cols:
            conn.execute("ALTER TABLE project_summary ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
        project_summary_defaults = {
            "project_category": "TEXT",
            "region": "TEXT",
            "os": "TEXT",
            "device_type": "TEXT",
            "chipset_status": "TEXT",
            "chipset_vendor": "TEXT",
            "chipset_newness": "TEXT",
            "pipeline": "TEXT",
            "operators_json": "TEXT NOT NULL DEFAULT '[]'",
            "user_programs_json": "TEXT NOT NULL DEFAULT '[]'",
            "idh_vendor": "TEXT",
            "fr_quantity": "REAL",
            "mm": "REAL",
            "support_sim": "TEXT",
            "valid_start_date": "TEXT",
            "valid_end_date": "TEXT",
        }
        for col, ddl in project_summary_defaults.items():
            if col not in cols:
                conn.execute(f"ALTER TABLE project_summary ADD COLUMN {col} {ddl}")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_weekly (
              project_name TEXT NOT NULL,
              source TEXT NOT NULL,
              forecast_version_id TEXT,
              week_label TEXT NOT NULL,
              week TEXT NOT NULL,
              date TEXT NOT NULL,
              created_count INTEGER NOT NULL,
              fixed_count INTEGER NOT NULL,
              cum_created INTEGER NOT NULL,
              cum_fixed INTEGER NOT NULL,
              backlog INTEGER NOT NULL,
              PRIMARY KEY (project_name, source, forecast_version_id, week_label)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS forecast_version (
              id TEXT PRIMARY KEY,
              project_name TEXT NOT NULL,
              cycle TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '',
              input_json TEXT NOT NULL,
              result_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              deleted_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jira_sync (
              id TEXT PRIMARY KEY,
              project_name TEXT NOT NULL,
              start_week TEXT NOT NULL,
              end_week TEXT NOT NULL,
              jql TEXT NOT NULL,
              mode TEXT NOT NULL,
              fetched_count INTEGER NOT NULL,
              written_count INTEGER NOT NULL,
              synced_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS team_config (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              team_type TEXT NOT NULL,
              enabled INTEGER NOT NULL,
              note TEXT NOT NULL DEFAULT '',
              forecast_ratio REAL,
              updated_at TEXT NOT NULL
            )
            """
        )
        team_config_cols = {row["name"] for row in conn.execute("PRAGMA table_info(team_config)").fetchall()}
        if "forecast_ratio" not in team_config_cols:
            conn.execute("ALTER TABLE team_config ADD COLUMN forecast_ratio REAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_config (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jira_issue (
              issue_key TEXT PRIMARY KEY,
              project_key TEXT NOT NULL,
              issue_type TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              resolved_at TEXT NOT NULL DEFAULT '',
              verified_sw_at TEXT NOT NULL DEFAULT '',
              closed_at TEXT NOT NULL DEFAULT '',
              postponed_at TEXT NOT NULL DEFAULT '',
              deleted_at TEXT NOT NULL DEFAULT '',
              removed_at TEXT NOT NULL DEFAULT '',
              reporter_team TEXT NOT NULL DEFAULT '',
              assignee_team TEXT NOT NULL DEFAULT '',
              raw_fields_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        jira_issue_cols = {row["name"] for row in conn.execute("PRAGMA table_info(jira_issue)").fetchall()}
        if "removed_at" not in jira_issue_cols:
            conn.execute("ALTER TABLE jira_issue ADD COLUMN removed_at TEXT NOT NULL DEFAULT ''")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jira_issue_component (
              issue_key TEXT NOT NULL,
              component_name TEXT NOT NULL,
              component_order INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (issue_key, component_name)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_import_state (
              project_key TEXT PRIMARY KEY,
              last_sync_at TEXT NOT NULL DEFAULT '',
              last_full_sync_at TEXT NOT NULL DEFAULT '',
              last_incremental_sync_at TEXT NOT NULL DEFAULT '',
              last_mode TEXT NOT NULL DEFAULT '',
              last_request_kind TEXT NOT NULL DEFAULT '',
              last_jql TEXT NOT NULL DEFAULT '',
              field_mapping_version TEXT NOT NULL DEFAULT '',
              issue_snapshot_version TEXT NOT NULL DEFAULT '',
              issue_count INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jira_issue_project_key ON jira_issue(project_key)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jira_issue_created_at ON jira_issue(project_key, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jira_issue_resolved_at ON jira_issue(project_key, resolved_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jira_issue_component_issue_key ON jira_issue_component(issue_key)")
        conn.execute(
            """
            INSERT OR REPLACE INTO schema_meta(key, value)
            VALUES('schema_version', '3')
            """
        )


def backup_database() -> Path:
    ensure_data_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"drp_{timestamp}.sqlite3"
    src = get_db_path()
    if src.exists():
        backup_path.write_bytes(src.read_bytes())
    else:
        backup_path.write_bytes(b"")
    return backup_path


def json_dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
