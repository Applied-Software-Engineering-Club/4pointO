"""Load a catalog JSON snapshot into the Supabase courses table.

The fetch script writes utils/data/courses.json. This script upserts that
file. It does not scrape the catalog. Rows are matched on catalog_id and
code, so running it again updates existing courses.

The service-role key bypasses row-level security. Keep it in .env.local.
Do not prefix it with NEXT_PUBLIC_.

Setup:
  Copy the project URL and service-role key into .env.local.

Examples:
  python utils/load_courses.py
  python utils/load_courses.py --input utils/data/courses.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = Path(__file__).resolve().parent / "data" / "courses.json"
BATCH_SIZE = 200
COLUMNS = (
    "catalog_id",
    "catalog_course_id",
    "code",
    "subject",
    "number",
    "title",
    "units_min",
    "units_max",
    "description",
    "prerequisites",
    "corequisites",
    "grading",
    "notes",
    "section",
    "source_url",
)


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :]
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_env() -> None:
    load_env_file(ROOT / ".env.local")
    load_env_file(ROOT / ".env")


def blank_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def course_row(course: dict, catalog_id: str) -> dict:
    row = {column: blank_to_none(course.get(column)) for column in COLUMNS}
    row["catalog_id"] = blank_to_none(course.get("catalog_id")) or catalog_id
    row["code"] = (course.get("code") or "").strip()
    row["title"] = (course.get("title") or "").strip() or row["code"]
    return row


def rows_from_snapshot(payload: dict) -> list[dict]:
    catalog_id = str(payload.get("catalog_id") or "").strip()
    if not catalog_id:
        raise SystemExit("Snapshot is missing catalog_id.")
    courses = payload.get("courses")
    if not isinstance(courses, list):
        raise SystemExit("Snapshot is missing a courses array.")

    deduped: dict[tuple[str, str], dict] = {}
    skipped = 0
    for course in courses:
        row = course_row(course, catalog_id)
        if not row["code"]:
            skipped += 1
            continue
        deduped[(row["catalog_id"], row["code"])] = row
    if skipped:
        print(f"Skipped {skipped} courses with no code.", file=sys.stderr)
    return list(deduped.values())


def upsert_batch(url: str, service_key: str, batch: list[dict]) -> None:
    endpoint = f"{url.rstrip('/')}/rest/v1/courses?on_conflict=catalog_id,code"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(batch).encode("utf-8"),
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Supabase returned {error.code}: {detail}") from error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upsert a catalog JSON snapshot into Supabase.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Catalog snapshot JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_env()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not service_key:
        raise SystemExit(
            "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
        )
    if not args.input.is_file():
        raise SystemExit(f"Catalog snapshot not found: {args.input}")

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    rows = rows_from_snapshot(payload)
    if not rows:
        raise SystemExit("No courses to load.")

    loaded = 0
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        upsert_batch(url, service_key, batch)
        loaded += len(batch)
        print(f"Upserted {loaded}/{len(rows)}", file=sys.stderr, flush=True)
    print(f"Loaded {loaded} courses into {url}", file=sys.stderr)


if __name__ == "__main__":
    main()
