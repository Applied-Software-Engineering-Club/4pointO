"""Scrape SJSU professor courses from the class schedule.

The snapshot is the input for a later database load. This script does not
write to Supabase. It reads the public schedule page, whose table already
lists each section's course and instructor. Several sections of the same
course collapse into one professor-and-course pair. Staff and blank
instructors are left out.

The schedule is a single HTML page, so this script makes one request and
does not use Playwright. Pass --url for an archived term.

Setup:
  python -m pip install -r utils/requirements.txt

Examples:
  python utils/scrape_professor_courses.py
  python utils/scrape_professor_courses.py --prefix CS
  python utils/scrape_professor_courses.py --prefix CS --limit 5 --output utils/data/professor-course-sample.json
  python utils/scrape_professor_courses.py --url https://www.sjsu.edu/classes/schedules/archive/summer-2025.php
  python utils/scrape_professor_courses.py --self-test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

SCHEDULE_URL = "https://www.sjsu.edu/classes/schedules/fall-2026.php"
OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "professor-courses.json"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
TERM_RE = re.compile(r"\b(Fall|Spring|Summer|Winter)\s+(\d{4})\b", re.I)
SECTION_RE = re.compile(r"^(.+?)\s*\(Section\s+[^)]+\)$", re.I)
SKIP_NAMES = {"staff", "tba", "to be announced"}


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()
    return text or None


def course_code(cell) -> str | None:
    link = cell.find("a", href=True)
    if link is not None:
        query = parse_qs(urlparse(link["href"]).query)
        subject = clean((query.get("filter[27]") or [None])[0])
        number = clean((query.get("filter[29]") or [None])[0])
        if subject and number:
            return f"{subject.upper()} {number.upper()}"
    text = clean(cell.get_text(" ", strip=True))
    if text is None:
        return None
    match = SECTION_RE.match(text)
    if match is None:
        return None
    return clean(match.group(1).upper())


def instructors(cell) -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    links = cell.find_all("a", href=True)
    if links:
        for link in links:
            email = None
            href = link["href"]
            if href.lower().startswith("mailto:"):
                email = clean(href.split(":", 1)[1].split("?", 1)[0].lower())
            name = clean(link.get_text(" ", strip=True))
            if name is None or name.lower() in SKIP_NAMES:
                continue
            key = email or name.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append({"name": name, "email": email})
        return found

    name = clean(cell.get_text(" ", strip=True))
    if name is None or name.lower() in SKIP_NAMES:
        return []
    return [{"name": name, "email": None}]


def parse_term(soup: BeautifulSoup, page_url: str) -> str | None:
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    match = TERM_RE.search(title)
    if match:
        return f"{match.group(1).title()} {match.group(2)}"
    slug = Path(urlparse(page_url).path).stem.replace("-", " ")
    match = TERM_RE.search(slug)
    if match:
        return f"{match.group(1).title()} {match.group(2)}"
    return None


def parse_sections(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table#classSchedule")
    if table is None:
        raise SystemExit("Schedule page has no classSchedule table.")
    sections: list[dict] = []
    for row in table.select("tbody tr"):
        cells = row.find_all("td")
        if len(cells) < 10:
            continue
        code = course_code(cells[0])
        title = clean(cells[3].get_text(" ", strip=True))
        if code is None or title is None:
            continue
        for instructor in instructors(cells[9]):
            sections.append(
                {
                    "code": code,
                    "title": title,
                    "name": instructor["name"],
                    "email": instructor["email"],
                }
            )
    return sections


def teaching_rows(sections: list[dict], prefixes: list[str] | None, limit: int | None) -> list[dict]:
    wanted = {prefix.upper() for prefix in prefixes} if prefixes else None
    professors: dict[str, dict] = {}
    for section in sections:
        subject = section["code"].split(" ", 1)[0]
        if wanted is not None and subject not in wanted:
            continue
        key = section["email"] or section["name"].lower()
        professor = professors.get(key)
        if professor is None:
            professor = {
                "name": section["name"],
                "email": section["email"],
                "courses": {},
            }
            professors[key] = professor
        course = professor["courses"].get(section["code"])
        if course is None:
            professor["courses"][section["code"]] = {
                "code": section["code"],
                "title": section["title"],
                "sections": 1,
            }
        else:
            course["sections"] += 1

    rows = []
    for professor in professors.values():
        courses = sorted(professor["courses"].values(), key=lambda course: course["code"])
        rows.append(
            {
                "name": professor["name"],
                "email": professor["email"],
                "courses": courses,
            }
        )
    rows.sort(key=lambda professor: (professor["name"].lower(), professor["email"] or ""))
    if limit is not None:
        return rows[:limit]
    return rows


def write_snapshot(path: Path, page_url: str, term: str | None, professors: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "source": page_url,
        "term": term,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "professor_count": len(professors),
        "professors": professors,
    }
    path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")


def fetch_html(page_url: str) -> str:
    request = urllib.request.Request(page_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def parse_prefix_arg(value: str | None) -> list[str] | None:
    if not value:
        return None
    prefixes = [part.strip().upper() for part in value.split(",") if part.strip()]
    if not prefixes:
        raise SystemExit("--prefix needs at least one subject, such as CS.")
    return prefixes


SAMPLE_HTML = """
<html>
  <head><title>Fall 2026 | Class Schedules</title></head>
  <body>
    <table id="classSchedule">
      <tbody>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=CS&filter%5B29%5D=146">CS 146 (Section 01)</a></td>
          <td>1</td><td>In Person</td><td>Data Structures</td><td></td><td>3.0</td><td>LEC</td><td>MW</td><td>09:00AM-10:15AM</td>
          <td><a href="mailto:ada.lovelace@sjsu.edu">Ada Lovelace</a></td>
        </tr>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=CS&filter%5B29%5D=146">CS 146 (Section 02)</a></td>
          <td>2</td><td>In Person</td><td>Data Structures</td><td></td><td>3.0</td><td>LEC</td><td>TR</td><td>09:00AM-10:15AM</td>
          <td><a href="mailto:ada.lovelace@sjsu.edu">Ada Lovelace</a></td>
        </tr>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=CS&filter%5B29%5D=151">CS 151 (Section 01)</a></td>
          <td>3</td><td>In Person</td><td>Object-Oriented Design</td><td></td><td>3.0</td><td>LEC</td><td>MW</td><td>12:00PM-01:15PM</td>
          <td>
            <a href="mailto:ada.lovelace@sjsu.edu">Ada Lovelace</a>
            <a href="mailto:grace.hopper@sjsu.edu">Grace Hopper</a>
          </td>
        </tr>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=MATH&filter%5B29%5D=19">MATH 19 (Section 01)</a></td>
          <td>4</td><td>In Person</td><td>Precalculus</td><td></td><td>5.0</td><td>LEC</td><td>MW</td><td>08:00AM-09:15AM</td>
          <td><a href="mailto:grace.hopper@sjsu.edu">Grace Hopper</a></td>
        </tr>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=CS&filter%5B29%5D=49J">CS 49J (Section 01)</a></td>
          <td>5</td><td>In Person</td><td>Programming in Java</td><td></td><td>2.0</td><td>LEC</td><td>F</td><td>10:00AM-11:50AM</td>
          <td>Staff</td>
        </tr>
        <tr>
          <td><a href="https://catalog.sjsu.edu/content.php?filter%5B27%5D=CS&filter%5B29%5D=160">CS 160 (Section 01)</a></td>
          <td>6</td><td>In Person</td><td>Software Engineering</td><td></td><td>3.0</td><td>LEC</td><td>MW</td><td>01:30PM-02:45PM</td>
          <td>
            <a href="mailto:grace.hopper@sjsu.edu">Grace Hopper</a>
            <a href="mailto:grace.hopper@sjsu.edu">Grace Hopper</a>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
"""


def self_test() -> None:
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    assert parse_term(soup, SCHEDULE_URL) == "Fall 2026"
    sections = parse_sections(SAMPLE_HTML)
    assert len(sections) == 6
    professors = teaching_rows(sections, None, None)
    by_email = {professor["email"]: professor for professor in professors}
    ada = by_email["ada.lovelace@sjsu.edu"]
    assert [course["code"] for course in ada["courses"]] == ["CS 146", "CS 151"]
    assert ada["courses"][0]["sections"] == 2
    grace = by_email["grace.hopper@sjsu.edu"]
    assert [course["code"] for course in grace["courses"]] == ["CS 151", "CS 160", "MATH 19"]
    assert grace["courses"][2]["sections"] == 1
    assert all(professor["name"] != "Staff" for professor in professors)
    cs_only = teaching_rows(sections, ["CS"], None)
    assert all(
        course["code"].startswith("CS ")
        for professor in cs_only
        for course in professor["courses"]
    )
    assert "grace.hopper@sjsu.edu" in {professor["email"] for professor in cs_only}
    print("self-test ok", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=SCHEDULE_URL, help="Class schedule page. Default: Fall 2026.")
    parser.add_argument(
        "--prefix",
        default=None,
        help="Subject to keep, such as CS. Comma-separated for more than one. Default: every subject.",
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="JSON file to write.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stop after this many professors. Useful for a sample of the JSON shape.",
    )
    parser.add_argument("--self-test", action="store_true", help="Check the parser against sample HTML and exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    prefixes = parse_prefix_arg(args.prefix)
    html = fetch_html(args.url)
    term = parse_term(BeautifulSoup(html, "html.parser"), args.url)
    professors = teaching_rows(parse_sections(html), prefixes, args.limit)
    write_snapshot(args.output, args.url, term, professors)
    course_count = sum(len(professor["courses"]) for professor in professors)
    print(
        f"Wrote {len(professors)} professors and {course_count} courses to {args.output}",
        file=sys.stderr,
        flush=True,
    )


if __name__ == "__main__":
    main()
