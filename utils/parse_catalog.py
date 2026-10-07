"""Fetch SJSU catalog courses and write a JSON snapshot.

The snapshot is the input for a later database load. This script does not
write to Supabase. Course search for the GPA calculator, and course planning
later, can both read the same fields: code, title, units, description, and
prerequisites.

The catalog is behind an AWS WAF browser check, so fetching uses Playwright.
Listing and expanded course pages come from content.php. robots.txt disallows
/ajax/, and this script does not request those URLs. robots.txt also asks for
a 120 second crawl delay; --delay defaults to 2 seconds for a once-a-semester
snapshot. Pass --delay 120 to follow that request strictly.

Setup:
  python -m pip install -r utils/requirements.txt
  python -m playwright install chromium

Examples:
  python utils/parse_catalog.py
  python utils/parse_catalog.py --prefix CS
  python utils/parse_catalog.py --prefix CS --limit 2 --output utils/data/course-sample.json
  python utils/parse_catalog.py --prefix CS,MATH --output utils/data/courses.json
  python utils/parse_catalog.py --self-test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

BASE_URL = "https://catalog.sjsu.edu/"
OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "courses.json"
HEADING_RE = re.compile(r"^([A-Z]{2,5})\s+(\d+[A-Z]*)\s+-\s+(.+)$")
UNITS_RE = re.compile(r"(\d+)(?:\s*(?:-|to)\s*(\d+))?$")
UNITS_TEXT_RE = re.compile(r"(\d+)(?:\s*(?:-|to)\s*(\d+))?\s+unit", re.I)
CPAGE_RE = re.compile(r"filter(?:\[|%5B)cpage(?:\]|%5D)=(\d+)", re.I)
LABELS = {
    "prerequisite(s)": "prerequisites",
    "prerequisites": "prerequisites",
    "corequisite(s)": "corequisites",
    "corequisites": "corequisites",
    "grading": "grading",
    "note(s)": "notes",
    "notes": "notes",
}


def split_heading(text: str) -> tuple[str, str, str, str] | None:
    normalized = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
    match = HEADING_RE.match(normalized)
    if match is None:
        return None
    subject, number, title = match.group(1), match.group(2), match.group(3).strip()
    return f"{subject} {number}", subject, number, title


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    text = re.sub(r"\s+([)\]])", r"\1", text)
    return text or None


def node_text(node: NavigableString | Tag) -> str:
    if isinstance(node, NavigableString):
        return str(node)
    return node.get_text(" ", strip=True)


def parse_course_block(heading: Tag, section: str | None) -> dict | None:
    parsed = split_heading(heading.get_text(" ", strip=True))
    if parsed is None:
        return None
    code, subject, number, title = parsed

    units_min = None
    units_max = None
    seen_units = False
    label = "description"
    buckets: dict[str, list[str]] = {
        "description": [],
        "prerequisites": [],
        "corequisites": [],
        "grading": [],
        "notes": [],
    }
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer
        text = clean(" ".join(buffer))
        buffer = []
        if text:
            buckets[label].append(text)

    for node in heading.next_siblings:
        name = getattr(node, "name", None)
        if name == "p" and "Class Schedule" in node.get_text(" ", strip=True):
            break
        if name == "strong":
            flush()
            raw = node.get_text(" ", strip=True).rstrip(":").lower()
            label = LABELS.get(raw, "notes")
            continue
        if name == "em":
            em_text = clean(node.get_text(" ", strip=True))
            if not em_text:
                continue
            units_match = UNITS_RE.match(em_text)
            if not seen_units and units_match and "unit" not in em_text.lower():
                units_min = int(units_match.group(1))
                units_max = int(units_match.group(2) or units_match.group(1))
                seen_units = True
                continue
            if re.fullmatch(r"unit(?:\(s\))?", em_text, re.I):
                seen_units = True
                continue
            if re.match(r"Satisfies|Repeatable", em_text, re.I):
                flush()
                label = "notes"
            buffer.append(em_text)
            continue
        if name in {"hr", "br", "script", "style"}:
            continue
        if name == "a" and (node.get("href") or "").startswith("javascript:"):
            continue
        chunk = clean(node_text(node))
        if not chunk:
            continue
        if "Class Schedule" in chunk and "Syllabus Information" in chunk:
            break
        buffer.append(chunk)
    flush()

    if units_min is None:
        fallback = UNITS_TEXT_RE.search(heading.parent.get_text(" ", strip=True))
        if fallback:
            units_min = int(fallback.group(1))
            units_max = int(fallback.group(2) or fallback.group(1))

    def joined(key: str) -> str | None:
        return clean(" ".join(buckets[key]))

    return {
        "code": code,
        "subject": subject,
        "number": number,
        "title": title,
        "units_min": units_min,
        "units_max": units_max,
        "description": joined("description"),
        "prerequisites": joined("prerequisites"),
        "corequisites": joined("corequisites"),
        "grading": joined("grading"),
        "notes": joined("notes"),
        "section": section,
        "catalog_course_id": None,
    }


def parse_expanded_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    courses: list[dict] = []
    seen: set[str] = set()
    for heading in soup.select("td.block_content h3"):
        section_tag = heading.find_previous("h2")
        section = None
        if section_tag is not None:
            name = clean(section_tag.get_text(" ", strip=True))
            if name and not re.search(r"Privacy|Cookie", name, re.I):
                section = name
        course = parse_course_block(heading, section)
        if course is None or course["code"] in seen:
            continue
        seen.add(course["code"])
        courses.append(course)
    return courses


def parse_listing_page(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    ids: dict[str, str] = {}
    for link in soup.select("a[onclick*='showCourse']"):
        match = re.search(
            r"showCourse\(\s*'(\d+)'\s*,\s*'(\d+)'",
            link.get("onclick", ""),
        )
        parsed = split_heading(link.get_text(" ", strip=True))
        if match is None or parsed is None:
            continue
        ids[parsed[0]] = match.group(2)
    return ids


def page_count(html: str, prefix_param: str, prefix: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    pages = [1]
    for link in soup.select("a[href]"):
        href = link["href"]
        if "cpage" not in href:
            continue
        query = parse_qs(urlparse(urljoin(BASE_URL, href)).query)
        if query.get(prefix_param, [None])[0] != prefix:
            continue
        match = CPAGE_RE.search(href)
        if match:
            pages.append(int(match.group(1)))
    return max(pages)


def discover_catalog(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    link = soup.find("a", string=re.compile(r"^\s*Course Descriptions\s*$"))
    if link is None or not link.get("href"):
        raise RuntimeError("Could not find the Course Descriptions link on the catalog home page.")
    query = parse_qs(urlparse(urljoin(BASE_URL, link["href"])).query)
    catoid = query.get("catoid", [None])[0]
    navoid = query.get("navoid", [None])[0]
    if not catoid or not navoid:
        raise RuntimeError(f"Course Descriptions link is missing catalog ids: {link['href']}")

    name = None
    select = soup.select_one("#select_catalog")
    if select is not None:
        for option in select.find_all("option"):
            if option.get("value") == catoid:
                name = clean(option.get_text(" ", strip=True))
                break
    if name is None:
        name_tag = soup.select_one(".acalog_catalog_name")
        name = clean(name_tag.get_text(" ", strip=True)) if name_tag else None

    return {"catoid": catoid, "navoid": navoid, "name": name or catoid}


def prefix_param_and_values(html: str) -> tuple[str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    select = soup.select_one("#courseprefix")
    if select is None or not select.get("name"):
        raise RuntimeError("Could not find the course prefix filter on the catalog page.")
    prefixes = []
    for option in select.find_all("option"):
        value = (option.get("value") or "").strip()
        if value and value != "-1":
            prefixes.append(value)
    if not prefixes:
        raise RuntimeError("The catalog page did not list any course prefixes.")
    return select["name"], prefixes


def content_url(catalog: dict[str, str], prefix_param: str, prefix: str, page: int, expanded: bool) -> str:
    query = {
        "catoid": catalog["catoid"],
        "navoid": catalog["navoid"],
        prefix_param: prefix,
        "filter[cpage]": str(page),
    }
    if expanded:
        query["expand"] = "1"
    return urljoin(BASE_URL, "content.php?" + urlencode(query))


def sort_key(course: dict) -> tuple:
    match = re.match(r"(\d+)", course["number"])
    return (course["subject"], int(match.group(1)) if match else 0, course["number"], course["title"])


def merge_courses(details: list[dict], catalog_ids: dict[str, str], catoid: str) -> list[dict]:
    merged = []
    for course in details:
        course = dict(course)
        course["catalog_id"] = catoid
        course["catalog_course_id"] = catalog_ids.get(course["code"])
        if course["catalog_course_id"]:
            course["source_url"] = (
                f"{BASE_URL}preview_course_nopop.php?catoid={catoid}&coid={course['catalog_course_id']}"
            )
        else:
            course["source_url"] = None
        merged.append(course)
    merged.sort(key=sort_key)
    return merged


def fetch_html(page, url: str, delay: float, state: dict) -> str:
    elapsed = time.monotonic() - state["last"]
    if state["last"] and elapsed < delay:
        time.sleep(delay - elapsed)
    page.goto(url, wait_until="domcontentloaded", timeout=90_000)
    page.wait_for_selector("td.block_content", timeout=90_000)
    state["last"] = time.monotonic()
    return page.content()


def scrape(
    page,
    prefixes: list[str],
    catalog: dict[str, str],
    prefix_param: str,
    delay: float,
    limit: int | None,
) -> list[dict]:
    state = {"last": 0.0}
    courses: list[dict] = []
    seen: set[str] = set()
    for index, prefix in enumerate(prefixes, start=1):
        print(f"[{index}/{len(prefixes)}] {prefix}", file=sys.stderr, flush=True)
        first_url = content_url(catalog, prefix_param, prefix, 1, expanded=False)
        listing_html = fetch_html(page, first_url, delay, state)
        last_page = page_count(listing_html, prefix_param, prefix)
        catalog_ids = parse_listing_page(listing_html)
        details = parse_expanded_page(fetch_html(page, content_url(catalog, prefix_param, prefix, 1, expanded=True), delay, state))
        if limit is None or len(details) < limit:
            for page_number in range(2, last_page + 1):
                listing_html = fetch_html(
                    page,
                    content_url(catalog, prefix_param, prefix, page_number, expanded=False),
                    delay,
                    state,
                )
                catalog_ids.update(parse_listing_page(listing_html))
                details.extend(
                    parse_expanded_page(
                        fetch_html(
                            page,
                            content_url(catalog, prefix_param, prefix, page_number, expanded=True),
                            delay,
                            state,
                        )
                    )
                )
                if limit is not None and len(details) >= limit:
                    break
        prefix_courses = merge_courses(details, catalog_ids, catalog["catoid"])
        added = 0
        for course in prefix_courses:
            if course["code"] in seen:
                continue
            if limit is not None and len(courses) >= limit:
                break
            seen.add(course["code"])
            courses.append(course)
            added += 1
        print(f"  {added} courses", file=sys.stderr, flush=True)
        if limit is not None and len(courses) >= limit:
            break
    courses.sort(key=sort_key)
    return courses


def write_snapshot(path: Path, catalog: dict[str, str], prefixes: list[str], courses: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": BASE_URL,
        "catalog_id": catalog["catoid"],
        "catalog_name": catalog["name"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "prefixes": prefixes,
        "course_count": len(courses),
        "courses": courses,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def self_test() -> None:
    html = """
    <td class="block_content">
      <h2>Computer Science</h2>
      <ul>
        <li>
          <h3>CS 146&nbsp;-&nbsp;Data Structures and Algorithms </h3><hr>
          <em>3</em> <em>unit(s)</em> <br>
          Implementations of advanced tree structures.
          <strong>Prerequisite(s):</strong> <a href="#">MATH 30</a>, <a href="#">MATH 42</a>, and <a href="#">CS 46B</a>.<br>
          <strong>Grading:</strong> Letter Graded<br>
          <p>Class Schedule | Syllabus Information | University Bookstore</p>
        </li>
        <li>
          <h3>CS 180&nbsp;-&nbsp;Individual Studies</h3><hr>
          <em>1-3</em> <em>unit(s)</em> <br>
          Individual study in a specific field.<br>
          <strong>Prerequisite(s):</strong> Department chair consent.<br>
          <strong>Grading:</strong> Credit/No Credit<br>
        </li>
      </ul>
      <h2>Activity/Physical Education Classes</h2>
      <ul>
        <li>
          <h3>KIN 1&nbsp;-&nbsp;Adapted Physical Activities </h3><hr>
          <em>1</em> <em>unit(s)</em> <br>
          Structured individualized physical activities.<br>
          <em>Satisfies</em> <em>PE: Physical Education.</em><br>
          <em>Repeatable for credit with instructor consent.</em><br>
          <strong>Grading:</strong> Letter Graded<br>
          <strong>Note(s):</strong> Movement Area 2 Fitness<br>
        </li>
      </ul>
    </td>
    """
    listing = """
    <a onclick="showCourse('23', '198982',this, ''); return false;">CS 146&nbsp;-&nbsp;Data Structures and Algorithms</a>
    <a onclick="showCourse('23', '200001',this, ''); return false;">CS 180&nbsp;-&nbsp;Individual Studies</a>
    """
    courses = merge_courses(parse_expanded_page(html), parse_listing_page(listing), "23")
    by_code = {course["code"]: course for course in courses}
    cs146 = by_code["CS 146"]
    cs180 = by_code["CS 180"]
    kin = by_code["KIN 1"]
    assert cs146["title"] == "Data Structures and Algorithms"
    assert cs146["units_min"] == 3 and cs146["units_max"] == 3
    assert cs146["prerequisites"] == "MATH 30, MATH 42, and CS 46B."
    assert cs146["grading"] == "Letter Graded"
    assert cs146["section"] == "Computer Science"
    assert cs146["catalog_course_id"] == "198982"
    assert "Class Schedule" not in (cs146["description"] or "")
    assert cs180["units_min"] == 1 and cs180["units_max"] == 3
    assert cs180["grading"] == "Credit/No Credit"
    assert kin["section"] == "Activity/Physical Education Classes"
    assert kin["notes"] and "Satisfies PE: Physical Education." in kin["notes"]
    assert "Repeatable for credit with instructor consent." in kin["notes"]
    assert "Movement Area 2 Fitness" in kin["notes"]
    assert kin["catalog_course_id"] is None
    print("self-test passed", file=sys.stderr)


def parse_prefix_arg(values: list[str]) -> list[str]:
    prefixes = []
    for value in values:
        prefixes.extend(part.strip().upper() for part in value.split(",") if part.strip())
    return prefixes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse SJSU catalog courses into a JSON snapshot.")
    parser.add_argument(
        "--prefix",
        action="append",
        default=[],
        help="Course prefix to fetch, such as CS. Repeat the flag or pass a comma-separated list. Default: every prefix.",
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="JSON file to write.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stop after this many courses. Useful for a sample of the JSON shape.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Seconds to wait between catalog page requests. robots.txt requests 120.",
    )
    parser.add_argument("--headed", action="store_true", help="Show the browser window.")
    parser.add_argument("--self-test", action="store_true", help="Check the parser against saved catalog HTML and exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return

    from playwright.sync_api import sync_playwright

    requested = parse_prefix_arg(args.prefix)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = context.new_page()
        state = {"last": 0.0}
        home_html = fetch_html(page, BASE_URL, args.delay, state)
        catalog = discover_catalog(home_html)
        descriptions_url = urljoin(
            BASE_URL,
            f"content.php?catoid={catalog['catoid']}&navoid={catalog['navoid']}",
        )
        filter_html = fetch_html(page, descriptions_url, args.delay, state)
        prefix_param, available = prefix_param_and_values(filter_html)
        if requested:
            missing = [prefix for prefix in requested if prefix not in available]
            if missing:
                raise SystemExit(f"Unknown course prefix: {', '.join(missing)}")
            prefixes = requested
        else:
            prefixes = available
        print(
            f"{catalog['name']} ({catalog['catoid']}), {len(prefixes)} prefix(es)",
            file=sys.stderr,
            flush=True,
        )
        if args.limit is not None and args.limit < 1:
            raise SystemExit("--limit must be at least 1")
        courses = scrape(page, prefixes, catalog, prefix_param, args.delay, args.limit)
        context.close()
        browser.close()

    missing_ids = sum(1 for course in courses if not course["catalog_course_id"])
    write_snapshot(args.output, catalog, prefixes, courses)
    print(
        f"Wrote {len(courses)} courses to {args.output} ({missing_ids} without a catalog course id)",
        file=sys.stderr,
        flush=True,
    )


if __name__ == "__main__":
    main()
