"""Download SJSU program and roadmap pages, then write one JSON file per program.

Pages are saved to a local HTML cache and skipped on later runs, so an
interrupted run can resume. After downloading, the whole cache is parsed into
utils/data/programs/. If a fetch fails, the existing JSON files are left alone.
To apply parser fixes without another crawl, run utils/program_scraping/parse_programs.py on its
own.

--delay defaults to the 120 seconds that robots.txt asks for. Program and index
pages are not disallowed by robots.txt, and this script does not request the
paths that are.

The catalog is behind an AWS WAF browser check. This script uses Playwright's
default user agent and does not try to disguise itself. If the check stops a
page, the run ends rather than retrying, and pages saved so far are kept.

Setup:
  python -m pip install -r utils/requirements.txt
  python -m playwright install chromium

Examples:
  python utils/program_scraping/fetch_programs.py --list
  python utils/program_scraping/fetch_programs.py --program 12345 --program 67890
  python utils/program_scraping/fetch_programs.py --limit 5
  python utils/program_scraping/fetch_programs.py --self-test
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup

from parse_catalog import BASE_URL, CPAGE_RE, clean, fetch_html
from parse_programs import OUTPUT_DIR, write_programs

DEFAULT_CATOID = "23"
PROGRAMS_NAVOID = "8470"
ROADMAPS_NAVOID = "8647"
ROBOTS_DELAY = 120.0
RAW_ROOT = Path(__file__).resolve().parent.parent / "data" / "programs_raw"
BACHELORS_RE = re.compile(r"\b(?:BA|BS|BFA|BM|BMus|BSN|B\.A\.|B\.S\.)(?=[\s,.)]|$)")


def program_url(catoid: str, poid: str) -> str:
    return f"{BASE_URL}preview_program.php?catoid={catoid}&poid={poid}"


def index_url(catoid: str, navoid: str) -> str:
    return f"{BASE_URL}content.php?catoid={catoid}&navoid={navoid}"


def parse_program_links(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    programs: dict[str, dict] = {}
    for link in soup.select("a[href*='preview_program.php']"):
        query = parse_qs(urlparse(urljoin(BASE_URL, link["href"])).query)
        poid = query.get("poid", [None])[0]
        name = clean(link.get_text(" ", strip=True))
        if poid and name and poid not in programs:
            programs[poid] = {"poid": poid, "name": name}
    return list(programs.values())


def index_page_urls(html: str) -> dict[int, str]:
    soup = BeautifulSoup(html, "html.parser")
    pages: dict[int, str] = {}
    for link in soup.select("a[href]"):
        match = CPAGE_RE.search(link["href"])
        if match:
            pages[int(match.group(1))] = urljoin(BASE_URL, link["href"])
    return pages


def is_bachelors(name: str) -> bool:
    return BACHELORS_RE.search(name) is not None and "+" not in name


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as output:
            output.write(text)
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise


def discover_programs(fetch: Callable[[str], str], catoid: str, navoid: str, raw_dir: Path) -> list[dict]:
    first_url = index_url(catoid, navoid)
    first_html = fetch(first_url)
    write_atomic(raw_dir / f"_index_{navoid}_1.html", first_html)
    programs = {item["poid"]: item for item in parse_program_links(first_html)}

    pending = index_page_urls(first_html)
    done = {1}
    while True:
        remaining = sorted(number for number in pending if number not in done)
        if not remaining:
            break
        number = remaining[0]
        html = fetch(pending[number])
        write_atomic(raw_dir / f"_index_{navoid}_{number}.html", html)
        for item in parse_program_links(html):
            programs.setdefault(item["poid"], item)
        pending.update(index_page_urls(html))
        done.add(number)
    return list(programs.values())


def fetch_missing(programs: list[dict], fetch: Callable[[str], str], catoid: str, raw_dir: Path) -> tuple[int, int]:
    fetched = 0
    skipped = 0
    for index, program in enumerate(programs, start=1):
        path = raw_dir / f"{program['poid']}.html"
        label = program.get("name") or program["poid"]
        if path.is_file():
            skipped += 1
            print(f"[{index}/{len(programs)}] cached: {label}", file=sys.stderr, flush=True)
            continue
        print(f"[{index}/{len(programs)}] fetching: {label}", file=sys.stderr, flush=True)
        write_atomic(path, fetch(program_url(catoid, program["poid"])))
        fetched += 1
    return fetched, skipped


def select_programs(discovered: list[dict], include_all: bool, limit: int | None) -> list[dict]:
    selected = discovered if include_all else [item for item in discovered if is_bachelors(item["name"])]
    return selected[:limit] if limit is not None else selected


def self_test() -> None:
    index = """
    <a href="preview_program.php?catoid=23&poid=1&returnto=8470">Computer Science, BS</a>
    <a href="preview_program.php?catoid=23&poid=1&returnto=8470">Computer Science, BS</a>
    <a href="preview_program.php?catoid=23&poid=2">Art, BFA</a>
    <a href="preview_program.php?catoid=23&poid=3">Computer Science, MS</a>
    <a href="preview_program.php?catoid=23&poid=4">Roadmap: Linguistics, BA</a>
    <a href="content.php?catoid=23&navoid=8470&filter[cpage]=2">2</a>
    """
    page_two = '<a href="preview_program.php?catoid=23&poid=5">Nursing, BS</a>'
    requested: list[str] = []
    pages = {
        index_url("23", "8470"): index,
        f"{BASE_URL}content.php?catoid=23&navoid=8470&filter[cpage]=2": page_two,
    }

    def fake_fetch(url: str) -> str:
        requested.append(url)
        return pages.get(url, f"<html>{url}</html>")

    assert is_bachelors("Computer Science, BS")
    assert is_bachelors("Art, BFA")
    assert not is_bachelors("Computer Science, MS")
    assert not is_bachelors("Business Minor")
    assert not is_bachelors("Computer Engineering, BS + MS")

    with tempfile.TemporaryDirectory() as temporary:
        raw_dir = Path(temporary)
        discovered = discover_programs(fake_fetch, "23", "8470", raw_dir)
        assert [item["poid"] for item in discovered] == ["1", "2", "3", "4", "5"]
        assert (raw_dir / "_index_8470_2.html").is_file()

        selected = select_programs(discovered, include_all=False, limit=None)
        assert [item["poid"] for item in selected] == ["1", "2", "4", "5"]
        assert [item["poid"] for item in select_programs(discovered, False, 2)] == ["1", "2"]

        requested.clear()
        (raw_dir / "1.html").write_text("cached", encoding="utf-8")
        assert fetch_missing(selected, fake_fetch, "23", raw_dir) == (3, 1)
        assert program_url("23", "1") not in requested
        assert (raw_dir / "1.html").read_text(encoding="utf-8") == "cached"

        requested.clear()
        assert fetch_missing(selected, fake_fetch, "23", raw_dir) == (0, 4)
        assert requested == []

        def blocked(url: str) -> str:
            raise TimeoutError("challenged")

        try:
            fetch_missing([{"poid": "9", "name": "Blocked, BS"}], blocked, "23", raw_dir)
        except TimeoutError:
            pass
        else:
            raise AssertionError("a failed fetch must stop the run")
        assert not (raw_dir / "9.html").exists()
        assert not list(raw_dir.glob("*.tmp"))
    print("self-test passed", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download SJSU catalog program pages to a local cache.")
    parser.add_argument("--catoid", default=DEFAULT_CATOID, help="Catalog id. 23 is 2026-2027.")
    parser.add_argument(
        "--navoid",
        action="append",
        default=[],
        help=f"Nav id of an index page to discover from. Repeatable. Default: {PROGRAMS_NAVOID} (majors) and {ROADMAPS_NAVOID} (roadmaps).",
    )
    parser.add_argument("--output", type=Path, default=None, help="Folder for the program JSON files. Default: utils/data/programs, or a programs folder inside --output-dir.")
    parser.add_argument("--program", action="append", default=[], help="Program poid to fetch. Repeatable. Skips discovery.")
    parser.add_argument("--limit", type=int, default=None, help="Fetch at most this many discovered programs.")
    parser.add_argument("--delay", type=float, default=ROBOTS_DELAY, help="Seconds between requests. robots.txt requests 120.")
    parser.add_argument("--all-programs", action="store_true", help="Include programs other than bachelor's degrees.")
    parser.add_argument("--list", action="store_true", help="Print the discovered programs and exit without fetching them.")
    parser.add_argument("--output-dir", type=Path, default=None, help="Cache folder. Default: utils/data/programs_raw/<catoid>.")
    parser.add_argument("--headed", action="store_true", help="Show the browser window.")
    parser.add_argument("--self-test", action="store_true", help="Run offline checks and exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    if args.delay < ROBOTS_DELAY:
        print(f"Warning: --delay {args.delay:g} is below the {ROBOTS_DELAY:g} seconds robots.txt requests.", file=sys.stderr)

    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import sync_playwright

    raw_dir = args.output_dir or RAW_ROOT / args.catoid
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        context = browser.new_context(locale="en-US")
        page = context.new_page()
        state = {"last": 0.0}

        def fetch(url: str) -> str:
            return fetch_html(page, url, args.delay, state)

        try:
            if args.program:
                programs = [{"poid": poid} for poid in args.program]
            else:
                discovered: dict[str, dict] = {}
                for navoid in args.navoid or [PROGRAMS_NAVOID, ROADMAPS_NAVOID]:
                    for item in discover_programs(fetch, args.catoid, navoid, raw_dir):
                        discovered.setdefault(item["poid"], item)
                programs = select_programs(list(discovered.values()), args.all_programs, args.limit)
                if not programs:
                    raise SystemExit("No programs found. The index page layout may have changed.")
            if args.list:
                for program in programs:
                    print(f"{program['poid']}\t{program['name']}")
                return
            fetched, skipped = fetch_missing(programs, fetch, args.catoid, raw_dir)
        except PlaywrightError as error:
            first_line = str(error).splitlines()[0] if str(error) else type(error).__name__
            raise SystemExit(
                f"Stopped: the catalog did not serve a page ({first_line}). "
                "This may be its bot check. Pages saved so far are kept. Do not retry in a loop."
            ) from error
        finally:
            context.close()
            browser.close()

    print(f"Fetched {fetched}, skipped {skipped} already cached, in {raw_dir}", file=sys.stderr)
    output = args.output or (args.output_dir / "programs" if args.output_dir else OUTPUT_DIR)
    write_programs(raw_dir, args.catoid, output)


if __name__ == "__main__":
    main()
