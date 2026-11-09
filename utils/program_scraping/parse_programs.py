"""Turn cached SJSU program pages into one JSON file per program.

utils/program_scraping/fetch_programs.py calls this after downloading. It can also run on its own
to rebuild the JSON from the cache without any network requests. Every run
rebuilds from all cached pages. "Roadmap: X" pages are merged into the "roadmap"
field of the program named X.

Files go in utils/data/programs/, named after the program, such as
computer-science-bs.json. Each file holds one object with exactly these fields:
  catalog_id, poid, name, degree, pathway, total_units, source_url,
  requirements, roadmap

Each requirement has exactly these fields:
  title, rule, units, min_grade, courses, source_text, children

Rules that the output format can't express faithfully become unparsed. The
terminal report lists parse coverage, warnings and any roadmap items left out of
the JSON.

The key rule: a requirement only gets a rule when its wording matches a known
pattern exactly. Anything else becomes "unparsed" with its original text kept,
so the audit can show "check manually" and never guess that it is satisfied.

A course list with no instruction counts as all_of only when its heading states
units and the listed courses add up to them. A heading with sub-sections counts
as requiring all of them only when their stated units add up the same way.

Rule types in the output:
  all_of          every listed course, plus every child requirement
  choose_units    "units" units from the listed courses
  choose_courses  courses from the list adding up to "units"
  pattern         "units" units described in "source_text"
  unparsed        anything else

Examples:
  python utils/program_scraping/parse_programs.py
  python utils/program_scraping/parse_programs.py --self-test
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

from parse_catalog import BASE_URL, clean

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "programs"
HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
ORDINAL_YEARS = {"first": 1, "freshman": 1, "second": 2, "sophomore": 2, "third": 3, "junior": 3, "fourth": 4, "senior": 4}

COURSE_RE = re.compile(r"^([A-Z]{2,5}\d?)\s+(\d+[A-Z]*)(?=\s|$|[-,.:;])")
DEGREE_RE = re.compile(r"\b(BMus|BFA|BSN|BA|BS|BM|MA|MS|MBA|MFA|PhD|B\.A\.|B\.S\.)(?=[\s,.)]|$)")
TRANSFER_RE = re.compile(r"\b(?:AS-T|AA-T|ADT|transfer|2[- ]year)\b", re.I)
GRADE_RE = re.compile(
    r",?\s*(?:with\s+)?(?:an?\s+)?(?:minimum\s+)?grade\s+of\s+(?:at\s+least\s+)?([A-D][+-]?)(?![A-Za-z])(?:\s+or\s+(?:better|higher))?",
    re.I,
)
VERB = r"(?:complete|select|choose|take)"
FOLLOWING = r"(?:the\s+)?(?:following|list\s+below)(?:\s+courses?)?(?:\s+below)?"
CHOOSE_UNITS_RE = re.compile(rf"{VERB}\s+(?:a\s+minimum\s+of\s+|at\s+least\s+)?(\d+)\s+units?\s+(?:from|of|in)\s+{FOLLOWING}", re.I)
CHOOSE_COURSES_RE = re.compile(rf"{VERB}\s+(one|two|three|four|five|six|\d+)(?:\s+courses?)?(?:\s+(?:from|of)(?:\s+{FOLLOWING})?)?", re.I)
ALL_OF_RE = re.compile(rf"(?:{VERB}\s+)?(?:all\s+(?:of\s+)?)?(?:the\s+)?following(?:\s+courses?)?", re.I)
PATTERN_RE = re.compile(rf"{VERB}\s+(\d+)\s+units?\s+(?:of|from|in)\s+(?:any\s+)?upper[- ]division\s+([A-Z]{{2,5}}\d?)(?:\s+courses?)?", re.I)
TITLE_UNITS_RE = re.compile(r"\(\s*(\d+)(?:\s*-\s*(\d+))?\s+units?\s*\)\s*:?\s*$", re.I)
ITEM_UNITS_RE = re.compile(r"(\d+)(?:\s*-\s*(\d+))?\s*unit\(s\)", re.I)
OPTION_SPLIT_RE = re.compile(r"(?<=unit\(s\))(?:\s*\(\s*(?:GE|Formerly)\b[^()]*\))?\s*(?:or|/)\s+", re.I)
STATED_GRADE_RE = re.compile(r"\b([A-D][+-]?)[”\"']?\s+or\s+(?:better|higher)\b")
GRADE_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"]
GE_NOTE_RE = re.compile(r"\(\s*(?:GE|Formerly)\b[^()]*\)")
JOINED_COURSE_RE = re.compile(r"(?:\band\b|&|,|\bplus\b)\s*[A-Z]{2,5}\d?\s+\d+[A-Z]*\b")
TOTAL_RE = re.compile(r"^total\b[^\d]*(\d{2,3})\b", re.I)
REQUIRED_RE = re.compile(r"\brequired\b", re.I)
SKIP_TITLE_RE = re.compile(r"\b(?:learning outcomes|program information|program overview|accreditation|admission|contact|summary of degree units)\b", re.I)
ROADMAP_RE = re.compile(r"\broad\s?map\b", re.I)
YEAR_RE = re.compile(r"(?:year\s*([1-4])|(first|second|third|fourth|freshman|sophomore|junior|senior)\s+year)", re.I)
TERM_RE = re.compile(
    rf"(?:{YEAR_RE.pattern}\s*[-:,]?\s*)?(fall|spring|summer|winter)(?:\s+(?:semester|term))?(?:\s*[-:,]?\s*\(?\d+(?:\s*-\s*\d+)?\s+units?\)?)?",
    re.I,
)
GE_ITEM_RE = re.compile(r"^(?:GE|General Education)(?:\s+Area)?:?\s+([A-Z0-9]{1,3})\b.*?(?:(\d+)\s+unit(?:s|\(s\))?)?\)?\.?$", re.I)
ELECTIVE_ITEM_RE = re.compile(r"^(?:[\w-]+\s+)*electives?\b.*?(?:(\d+)\s+unit(?:s|\(s\))?)?\)?\.?$", re.I)


def has_class(tag: Tag, name: str) -> bool:
    return name in (tag.get("class") or [])


def tidy(value: str) -> str | None:
    return clean(value.replace("​", " "))


def parse_course_entry(text: str, require_units: bool) -> list[tuple] | None:
    """Return [(code, min_units, max_units), ...] or None if the entry is unclear."""
    options = []
    for segment in OPTION_SPLIT_RE.split(text):
        match = COURSE_RE.match(segment)
        units = ITEM_UNITS_RE.search(segment)
        if match is None or JOINED_COURSE_RE.search(segment) or (require_units and units is None):
            return None
        if units and GE_NOTE_RE.sub("", segment[units.end():]).strip():
            return None
        low = int(units.group(1)) if units else None
        high = int(units.group(2) or units.group(1)) if units else None
        options.append((f"{match.group(1)} {match.group(2)}", low, high))
    return options


def read_core(core: Tag) -> dict:
    """Read one acalog-core block, leaving nested blocks to their own call."""
    node = {"title": None, "level": 7, "text": [], "items": [], "tables": 0, "children": []}

    def walk(parent: Tag) -> None:
        for child in parent.children:
            if isinstance(child, Comment):
                continue
            if isinstance(child, NavigableString):
                node["text"].append(str(child))
                continue
            if not isinstance(child, Tag) or child.name in {"script", "style"} or has_class(child, "acalog-core"):
                continue
            if child.name in HEADINGS and node["title"] is None:
                node["title"] = tidy(child.get_text(" ", strip=True))
                node["level"] = int(child.name[1])
            elif child.name == "li":
                read_item(child, node)
            else:
                if child.name == "table":
                    node["tables"] += 1
                walk(child)

    walk(core)
    node["text"] = tidy(" ".join(node["text"])) or ""
    return node


def read_item(item: Tag, node: dict) -> None:
    text = tidy(item.get_text(" ", strip=True))
    if not text:
        return
    options = parse_course_entry(text, require_units=not has_class(item, "acalog-course"))
    if options:
        node["items"].append(("course", options))
    else:
        node["items"].append(("text", text))


def build_tree(content: Tag) -> list[dict]:
    roots: list[dict] = []
    stack: list[dict] = []
    for core in content.select("div.acalog-core"):
        node = read_core(core)
        if node["title"] is None and not node["text"] and not node["items"]:
            continue
        while stack and stack[-1]["level"] >= node["level"]:
            stack.pop()
        (stack[-1]["children"] if stack else roots).append(node)
        if node["title"] is not None:
            stack.append(node)
    return roots


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.;:])\s+", text)
    return [part.strip(" .;:") for part in parts if part.strip(" .;:")]


def extract_grade(text: str) -> tuple[str | None, str]:
    grades = {match.group(1).upper() for match in GRADE_RE.finditer(text)}
    remainder = GRADE_RE.sub("", text)
    if len(grades) != 1:
        return None, text
    kept = [part for part in split_sentences(remainder) if part.lower() not in {"required", "is required"}]
    return grades.pop(), ". ".join(kept)


def match_instruction(sentence: str, courses: list[str]) -> dict | None:
    match = PATTERN_RE.fullmatch(sentence)
    if match:
        return None if courses else {"rule": "pattern", "units": int(match.group(1)), "subject": match.group(2).upper(), "division": "upper"}
    if not courses:
        return None
    match = CHOOSE_UNITS_RE.fullmatch(sentence)
    if match:
        return {"rule": "choose_units", "units": int(match.group(1))}
    match = CHOOSE_COURSES_RE.fullmatch(sentence)
    if match:
        word = match.group(1).lower()
        count = NUMBER_WORDS.get(word) or int(word)
        return {"rule": "choose_courses", "count": count} if count <= len(courses) else None
    if ALL_OF_RE.fullmatch(sentence):
        return {"rule": "all_of"}
    return None


def stated_range(title: str | None) -> tuple[int, int] | None:
    match = TITLE_UNITS_RE.search(title or "")
    if match is None:
        return None
    return int(match.group(1)), int(match.group(2) or match.group(1))


def add_ranges(ranges: list[tuple[int, int] | None]) -> tuple[int, int] | None:
    if any(item is None for item in ranges):
        return None
    return sum(item[0] for item in ranges), sum(item[1] for item in ranges)


def entry_range(options: list[tuple]) -> tuple[int, int] | None:
    """Units for one catalog entry, or None if its alternatives differ."""
    ranges = {(low, high) for _, low, high in options}
    if len(ranges) != 1 or None in next(iter(ranges)):
        return None
    return next(iter(ranges))


def units_agree(result: dict, stated: tuple[int, int] | None, entries: list[list[tuple]]) -> bool:
    if stated is None:
        return True
    rule = result["rule"]
    if rule in {"choose_units", "pattern"}:
        return stated == (result["units"], result["units"])
    ranges = [entry_range(entry) for entry in entries]
    if None in ranges:
        return True
    if rule == "all_of":
        return add_ranges(ranges) == stated
    if rule == "choose_courses":
        low = result["count"] * min(item[0] for item in ranges)
        high = result["count"] * max(item[1] for item in ranges)
        return low <= stated[1] and stated[0] <= high
    return True


def lowest_stated_grade(text: str) -> str | None:
    grades = [grade for grade in STATED_GRADE_RE.findall(text) if grade in GRADE_ORDER]
    return min(grades, key=GRADE_ORDER.index) if grades else None


def codes_in_entry(text: str) -> list[str]:
    matches = (COURSE_RE.match(segment) for segment in OPTION_SPLIT_RE.split(text))
    return [f"{match.group(1)} {match.group(2)}" for match in matches if match]


def classify(node: dict, inherited_grade: str | None = None) -> dict:
    """Pick a rule, falling back to unparsed unless the wording is unambiguous."""
    title = node["title"] or ""
    stated = stated_range(title)
    entries = [value for kind, value in node["items"] if kind == "course"]
    course_options = [[option[0] for option in entry] for entry in entries]
    courses = list(dict.fromkeys(code for options in course_options for code in options))
    extra = [value for kind, value in node["items"] if kind == "text"]
    source_text = clean(" ".join(part for part in [node["text"], *extra] if part))
    # Entries with notes can't get a rule, but still count toward unparsed progress.
    listed_with_notes = [code for value in extra for code in codes_in_entry(value)]
    min_grade, instruction = extract_grade(node["text"])
    min_grade = min_grade or lowest_stated_grade(node["text"]) or inherited_grade
    sentences = split_sentences(instruction)
    children = node["children"]

    result = None
    if not extra:
        if len(sentences) == 1 and not children:
            result = match_instruction(sentences[0], courses)
        elif not sentences and not children:
            bare_title = TITLE_UNITS_RE.sub("", title).strip(" :")
            result = match_instruction(bare_title, courses)
            listed = add_ranges([entry_range(entry) for entry in entries]) if entries else None
            if result is None and courses and (REQUIRED_RE.search(title) or (stated and listed == stated)):
                result = {"rule": "all_of"}
        elif not sentences and children and stated:
            own = [entry_range(entry) for entry in entries]
            parts = own + [stated_range(child["title"]) for child in children]
            if add_ranges(parts) == stated:
                result = {"rule": "all_of" if entries else "group"}

    if result and not children and not units_agree(result, stated, entries):
        result = None
    if result and stated and stated[0] == stated[1]:
        result.setdefault("units", stated[0])

    entry_ranges = {entry_range(entry) for entry in entries}
    single_range = next(iter(entry_ranges)) if len(entry_ranges) == 1 else None
    requirement = {
        "title": title or "(untitled)",
        "rule": "unparsed",
        "units": None,
        "count": None,
        "per_course_units": single_range[0] if single_range and single_range[0] == single_range[1] else None,
        "stated_units": list(stated) if stated else None,
        "min_grade": min_grade,
        "courses": list(dict.fromkeys(courses + listed_with_notes)),
        "course_options": course_options,
        "entry_units": [entry_range(entry) for entry in entries],
        "source_text": source_text or title,
        "children": [classify(child, min_grade) for child in children],
    }
    if result:
        requirement.update(result)
    return requirement


def split_sections(nodes: list[dict]) -> tuple[list[dict], list[dict], int | None]:
    requirements: list[dict] = []
    roadmap: list[dict] = []
    total_units = None
    for node in nodes:
        title = node["title"] or ""
        total = TOTAL_RE.match(title)
        if total and not node["items"] and not node["children"]:
            total_units = int(total.group(1))
        elif ROADMAP_RE.search(title) or TERM_RE.fullmatch(title) or YEAR_RE.fullmatch(title):
            roadmap.append(node)
        elif SKIP_TITLE_RE.search(title) and not node["items"]:
            continue
        else:
            kept, nested_roadmap, nested_total = split_sections(node["children"])
            roadmap.extend(nested_roadmap)
            total_units = total_units if nested_total is None else nested_total
            requirements.append({**node, "children": kept})
    return requirements, roadmap, total_units


def roadmap_item(kind: str, value) -> dict:
    if kind == "course":
        item = {"kind": "course", "code": value[0][0]}
        if len(value) > 1:
            item["alternatives"] = [option[0] for option in value[1:]]
        return item
    course = COURSE_RE.match(value)
    if course:
        return {"kind": "course", "code": f"{course.group(1)} {course.group(2)}"}
    match = GE_ITEM_RE.match(value)
    if match:
        return {"kind": "ge", "area": match.group(1).upper(), "units": int(match.group(2)) if match.group(2) else None}
    match = ELECTIVE_ITEM_RE.match(value)
    if match:
        return {"kind": "elective", "units": int(match.group(1)) if match.group(1) else None}
    return {"kind": "unparsed", "text": value}


def parse_roadmap(nodes: list[dict]) -> tuple[list[dict], list[str]]:
    terms: list[dict] = []
    unparsed: list[str] = []

    def year_number(match: re.Match, first_group: int) -> int | None:
        if match.group(first_group):
            return int(match.group(first_group))
        word = match.group(first_group + 1)
        return ORDINAL_YEARS[word.lower()] if word else None

    def visit(node: dict, year: int | None) -> None:
        title = node["title"] or ""
        year_match = YEAR_RE.fullmatch(title)
        term_match = TERM_RE.fullmatch(title)
        if year_match:
            year = year_number(year_match, 1)
        if term_match:
            items = [roadmap_item(kind, value) for kind, value in node["items"]]
            terms.append({"year": year_number(term_match, 1) or year, "term": term_match.group(3).capitalize(), "items": items})
        elif node["items"] or node["tables"]:
            unparsed.append(clean(f"{title} {node['text']}") or "(untitled roadmap section)")
        for child in node["children"]:
            visit(child, year)

    for node in nodes:
        visit(node, None)
    return terms, unparsed


def export_requirement(requirement: dict) -> dict:
    """Write a requirement using only the template's fields.

    An all_of entry such as "CS 46A or CS 46AX" becomes a choose_courses child,
    because a flat course list would imply both are required. An unparsed
    requirement keeps the units from its heading so progress can still be shown,
    but the audit must never treat it as met.
    """
    rule = requirement["rule"]
    units = requirement["units"]
    courses = requirement["courses"]
    children = [export_requirement(child) for child in requirement["children"]]
    if rule == "group":
        rule = "all_of"
    elif rule == "all_of" and any(len(options) > 1 for options in requirement["course_options"]):
        pairs = list(zip(requirement["course_options"], requirement["entry_units"]))
        if all(len(options) == 1 or (entry and entry[0] == entry[1]) for options, entry in pairs):
            courses = [options[0] for options, _ in pairs if len(options) == 1]
            children = [
                {
                    "title": " or ".join(options),
                    "rule": "choose_courses",
                    "units": entry[0],
                    "min_grade": requirement["min_grade"],
                    "courses": options,
                    "source_text": " or ".join(options),
                    "children": [],
                }
                for options, entry in pairs
                if len(options) > 1
            ] + children
        else:
            rule = "unparsed"
    elif rule == "choose_courses":
        per_course = requirement["per_course_units"]
        if per_course is None:
            rule = "unparsed"
        else:
            units = requirement["count"] * per_course
    if rule == "unparsed":
        stated = requirement["stated_units"]
        units = stated[0] if stated and stated[0] == stated[1] else None
    return {
        "title": requirement["title"],
        "rule": rule,
        "units": units,
        "min_grade": requirement["min_grade"],
        "courses": courses,
        "source_text": requirement["source_text"],
        "children": children,
    }


def export_program(program: dict) -> dict:
    roadmap = []
    for term in program["roadmap"]:
        items = []
        for item in term["items"]:
            if item["kind"] != "unparsed":
                items.append({key: value for key, value in item.items() if key != "alternatives"})
        roadmap.append({"year": term["year"], "term": term["term"], "items": items})
    return {
        "catalog_id": program["catalog_id"],
        "poid": program["poid"],
        "name": program["name"],
        "degree": program["degree"],
        "pathway": program["pathway"],
        "total_units": program["total_units"],
        "source_url": program["source_url"],
        "requirements": [export_requirement(item) for item in program["requirements"]],
        "roadmap": roadmap,
    }


def template_coverage(requirements: list[dict]) -> tuple[int, int]:
    parsed = unparsed = 0
    for requirement in requirements:
        if requirement["rule"] == "unparsed":
            unparsed += 1
        elif requirement["courses"] or not requirement["children"]:
            parsed += 1
        child_parsed, child_unparsed = template_coverage(requirement["children"])
        parsed += child_parsed
        unparsed += child_unparsed
    return parsed, unparsed


def merge_roadmaps(programs: list[dict]) -> list[dict]:
    by_name = {item["name"]: item for item in programs if not (item["name"] or "").startswith("Roadmap:")}
    merged = []
    for program in programs:
        name = program["name"] or ""
        if not name.startswith("Roadmap:"):
            merged.append(program)
            continue
        base_name = clean(name.split(":", 1)[1])
        target = by_name.get(base_name)
        if target is None:
            program["warnings"].append("No cached program page with this name, so it has no requirements.")
            program["name"] = base_name
            merged.append(program)
        elif target["roadmap"]:
            target["warnings"].append(f"Ignored a second roadmap page, poid {program['poid']}.")
        else:
            target["roadmap"] = program["roadmap"]
            target["roadmap_unparsed"] = program["roadmap_unparsed"]
    return sorted(merged, key=lambda item: item["name"] or "")


def parse_program(html: str, catalog_id: str, poid: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one("td.block_content")
    warnings: list[str] = []
    nodes: list[dict] = []
    name = None
    if content is None:
        warnings.append("No td.block_content found on the page.")
    else:
        heading = content.select_one("h1#acalog-content") or content.find("h1")
        name = clean(heading.get_text(" ", strip=True)) if heading else None
        nodes = build_tree(content)
        if not nodes:
            warnings.append("No div.acalog-core sections found on the page.")
    if not name:
        warnings.append("No program name found on the page.")

    raw_requirements, raw_roadmap, total_units = split_sections(nodes)
    requirements = [classify(node) for node in raw_requirements]
    roadmap, roadmap_unparsed = parse_roadmap(raw_roadmap)
    degree = DEGREE_RE.search(name or "")
    return {
        "catalog_id": catalog_id,
        "poid": poid,
        "name": name,
        "degree": degree.group(1).replace(".", "") if degree else None,
        "pathway": "2-year" if TRANSFER_RE.search(name or "") else "4-year",
        "total_units": total_units,
        "source_url": f"{BASE_URL}preview_program.php?catoid={catalog_id}&poid={poid}",
        "requirements": requirements,
        "roadmap": roadmap,
        "roadmap_unparsed": roadmap_unparsed,
        "warnings": warnings,
    }


def parse_cache(input_dir: Path, catalog_id: str) -> list[dict]:
    programs = []
    for path in sorted(input_dir.glob("*.html"), key=lambda item: item.stem):
        if not path.stem.startswith("_"):
            programs.append(parse_program(path.read_text(encoding="utf-8"), catalog_id, path.stem))
    return programs


def program_filename(name: str, poid: str, used: set[str]) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or poid
    filename = f"{slug}.json"
    if filename in used:
        filename = f"{slug}-{poid}.json"
    used.add(filename)
    return filename


def write_programs(input_dir: Path, catalog_id: str, output_dir: Path) -> list[dict]:
    """Rebuild one JSON file per program from every cached page and report coverage."""
    programs = merge_roadmaps(parse_cache(input_dir, catalog_id))
    if not programs:
        raise SystemExit(f"No cached program pages to parse in {input_dir}.")

    exported = []
    total_parsed = total_unparsed = 0
    for program in programs:
        if not program["name"]:
            print(f"{program['poid']}: left out of the JSON, no program name found", file=sys.stderr)
            continue
        item = export_program(program)
        exported.append(item)
        parsed, unparsed = template_coverage(item["requirements"])
        total_parsed += parsed
        total_unparsed += unparsed
        print(f"{item['poid']}: {parsed} parsed, {unparsed} unparsed - {item['name']}", file=sys.stderr)
        for warning in program["warnings"]:
            print(f"  warning: {warning}", file=sys.stderr)
        for text in program["roadmap_unparsed"]:
            print(f"  roadmap section left out: {text}", file=sys.stderr)
        for term in program["roadmap"]:
            for entry in term["items"]:
                if entry["kind"] == "unparsed":
                    print(f"  roadmap item left out: {entry['text']}", file=sys.stderr)

    output_dir.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    for item in exported:
        path = output_dir / program_filename(item["name"], item["poid"], used)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(json.dumps(item, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(temporary, path)
    print(f"Wrote {len(exported)} program files to {output_dir}: {total_parsed} parsed, {total_unparsed} unparsed", file=sys.stderr)
    return exported


SAMPLE_PAGE = """
<table><tr><td class="block_content">
  <h1 id="acalog-content">Computer Science, BS</h1>
  <div class="acalog-core"><h2>Program Learning Outcomes</h2><p>Graduates can reason about software.</p></div>
  <div class="acalog-core"><h2>Summary of Degree Units</h2><p>Core Lower Division GE: 18</p></div>
  <div class="acalog-core">
    <h2>Lower Division Core (8 units)</h2>
    <ul>
      <li class="acalog-course"><span><a href="#">CS 46A - Introduction to Programming</a> <em>4</em> <em>unit(s)</em> or <a href="#">CS 46AX - Introduction to Programming</a> <em>4 unit(s)</em></span></li>
      <li class="acalog-course"><span><a href="#">BUS1 20 - Business</a> <em>4</em> <em>unit(s)</em></span></li>
    </ul>
  </div>
  <div class="acalog-core">
    <h2>Major Electives</h2>
    <p>Complete 12 units from the following courses with a minimum grade of C-.</p>
    <ul>
      <li class="acalog-course"><a href="#">CS 132 - Computational Marine Biology</a> <em>3</em> <em>unit(s)</em> / <a href="#">BIOL 132 Computational Marine Biology</a> <em>3</em> <em>unit(s)</em></li>
      <li class="acalog-course"><a href="#">CS 151 - Object-Oriented Design</a> <em>3</em> <em>unit(s)</em> (GE Area 2 / Formerly Area B4)</li>
    </ul>
  </div>
  <div class="acalog-core">
    <h2>Math (3 units)</h2><p>Select one of the following:</p>
    <ul>
      <li class="acalog-course"><a href="#">MATH 30 - Calculus III</a> <em>3</em> <em>unit(s)</em></li>
      <li class="acalog-course"><a href="#">MATH 30P - Calculus with Precalculus</a> <em>3</em> <em>unit(s)</em></li>
    </ul>
  </div>
  <div class="acalog-core"><h2>Complete one course (3 units):</h2>
    <ul>
      <li class="acalog-course"><a href="#">ENGL 1 - Reading</a> <em>3</em> <em>unit(s)</em></li>
      <li class="acalog-course"><a href="#">ENGL 2 - Writing</a> <em>3</em> <em>unit(s)</em></li>
    </ul>
  </div>
  <div class="acalog-core"><h2>Plain List</h2><p>Complete one course from:</p>
    <ul><li>&#8203; ART 44HA Design Your Life 3 unit(s)</li><li>DSGN 44HA Design Your Life 3 unit(s)</li></ul>
  </div>
  <div class="acalog-core"><h2>Upper Division</h2><p>Complete 6 units of upper-division CS courses.</p></div>
  <div class="acalog-core">
    <h2>Lab Science</h2><p>Complete 6 units from the following, at most 3 from outside the department.</p>
    <ul><li class="acalog-course"><a href="#">PHYS 50 - General Physics</a> <em>4</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core">
    <h2>Statistics</h2><p>Complete the following courses:</p>
    <ul>
      <li class="acalog-course"><a href="#">MATH 161A - Statistics</a> <em>3</em> <em>unit(s)</em></li>
      <li class="acalog-adhoc">or</li>
      <li class="acalog-course"><a href="#">ISE 130 - Engineering Statistics</a> <em>3</em> <em>unit(s)</em></li>
    </ul>
  </div>
  <div class="acalog-core"><h2>Mismatch (9 units)</h2><p>Complete 12 units from the following.</p>
    <ul><li class="acalog-course"><a href="#">CS 160 - Software Engineering</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Unlabeled List</h2>
    <ul><li class="acalog-course"><a href="#">CS 166 - Security</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Wrong Sum (9 units)</h2>
    <ul><li class="acalog-course"><a href="#">CS 174 - Web Programming</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Joined Entry (6 units)</h2>
    <ul><li class="acalog-course"><a href="#">CS 1 - One</a> <em>3</em> <em>unit(s)</em> and CS 2 - Two <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Noted Entry (3 units)</h2>
    <ul><li class="acalog-course"><a href="#">BUS3 11 - Accounting</a> <em>3</em> <em>unit(s)</em> (BUS3 10 can be substituted for Transfer Students)</li></ul>
  </div>
  <div class="acalog-core"><h2>Graded Section (3 units)</h2><p>Complete these with “C-” or better, and CS 70 with “C” or better.</p></div>
  <div class="acalog-core"><h3>Graded Child (3 units)</h3>
    <ul><li class="acalog-course"><a href="#">CS 70 - Graded</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Concentration in Data Science</h2></div>
  <div class="acalog-core"><h3>Required Data Courses</h3>
    <ul><li class="acalog-course"><a href="#">DATA 220 - Data Analysis</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Depth (4 units)</h2></div>
  <div class="acalog-core"><h3>Required Depth Courses (4 units)</h3>
    <ul><li class="acalog-course"><a href="#">CS 171 - Machine Learning</a> <em>4</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Preparation (7 units)</h2>
    <ul><li class="acalog-course"><a href="#">CS 49 - Preparation</a> <em>4</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h3>Extra Course (3 units)</h3><p>Complete one course:</p>
    <ul><li class="acalog-course"><a href="#">CS 50 - Extra</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Elective Pool (6 units)</h2></div>
  <div class="acalog-core"><h3>Pool List</h3>
    <ul><li class="acalog-course"><a href="#">CS 60 - Pool</a> <em>3</em> <em>unit(s)</em></li></ul>
  </div>
  <div class="acalog-core"><h2>Total Units Required (120 units)</h2></div>
  <div class="acalog-core"><h2>Sample Roadmap</h2></div>
  <div class="acalog-core"><h3>Year 1</h3></div>
  <div class="acalog-core"><h4>Fall</h4>
    <ul>
      <li class="acalog-course"><a href="#">CS 46A - Introduction to Programming</a></li>
      <li class="acalog-adhoc">GE Area A1 (3 units)</li>
      <li class="acalog-adhoc">Elective (3 units)</li>
      <li class="acalog-adhoc">See your advisor</li>
    </ul>
  </div>
  <div class="acalog-core"><h3>Second Year Spring</h3>
    <ul>
      <li class="acalog-course"><a href="#">CS 146 - Data Structures</a> <em>3</em> <em>unit(s)</em>*</li>
      <li class="acalog-course"><a href="#">PHYS 2A - Physics</a> <em>4</em> <em>unit(s)</em> (GE Area 5A + 5C) or <a href="#">PHYS 50 - Mechanics</a> <em>4</em> <em>unit(s)</em> (GE Area 5A + 5C)</li>
    </ul>
  </div>
  <div class="acalog-core"><h3>Year 3 Spring Semester (13-14 units)</h3>
    <ul><li class="acalog-adhoc">GE Area 1B 3 unit(s)</li></ul>
  </div>
</td></tr></table>
"""


def self_test() -> None:
    program = parse_program(SAMPLE_PAGE, "23", "12345")
    by_title = {item["title"]: item for item in program["requirements"]}

    assert program["name"] == "Computer Science, BS"
    assert program["degree"] == "BS" and program["pathway"] == "4-year"
    assert program["total_units"] == 120
    assert program["source_url"].endswith("catoid=23&poid=12345")
    assert "Program Learning Outcomes" not in by_title
    assert "Summary of Degree Units" not in by_title
    assert "Total Units Required (120 units)" not in by_title

    core = by_title["Lower Division Core (8 units)"]
    assert core["rule"] == "all_of" and core["units"] == 8
    assert core["course_options"] == [["CS 46A", "CS 46AX"], ["BUS1 20"]]
    assert core["courses"] == ["CS 46A", "CS 46AX", "BUS1 20"]

    electives = by_title["Major Electives"]
    assert electives["rule"] == "choose_units" and electives["units"] == 12
    assert electives["min_grade"] == "C-"
    assert electives["course_options"] == [["CS 132", "BIOL 132"], ["CS 151"]]
    assert "Complete 12 units" in electives["source_text"]

    math = by_title["Math (3 units)"]
    assert math["rule"] == "choose_courses" and math["count"] == 1 and math["units"] == 3
    assert math["courses"] == ["MATH 30", "MATH 30P"]

    title_rule = by_title["Complete one course (3 units):"]
    assert title_rule["rule"] == "choose_courses" and title_rule["count"] == 1

    plain = by_title["Plain List"]
    assert plain["rule"] == "choose_courses" and plain["courses"] == ["ART 44HA", "DSGN 44HA"]

    pattern = by_title["Upper Division"]
    assert pattern["rule"] == "pattern" and pattern["units"] == 6
    assert pattern["subject"] == "CS" and pattern["division"] == "upper"

    for title in ["Lab Science", "Statistics", "Mismatch (9 units)", "Unlabeled List", "Wrong Sum (9 units)", "Joined Entry (6 units)", "Noted Entry (3 units)"]:
        assert by_title[title]["rule"] == "unparsed", title
    assert "at most 3 from outside" in by_title["Lab Science"]["source_text"]
    assert "or" in by_title["Statistics"]["source_text"].split()
    assert by_title["Wrong Sum (9 units)"]["stated_units"] == [9, 9]
    assert "can be substituted" in by_title["Noted Entry (3 units)"]["source_text"]
    assert by_title["Noted Entry (3 units)"]["courses"] == ["BUS3 11"]
    graded = by_title["Graded Section (3 units)"]
    assert graded["rule"] == "unparsed" and graded["min_grade"] == "C-"
    assert graded["children"][0]["rule"] == "all_of" and graded["children"][0]["min_grade"] == "C-"
    assert lowest_stated_grade("with “B” or better") == "B"
    assert lowest_stated_grade("no grade here") is None
    assert codes_in_entry("CS 180 - Studies 1-3 unit(s) or CS 180H - Honors 3 unit(s) (with approval)") == ["CS 180", "CS 180H"]

    concentration = by_title["Concentration in Data Science"]
    assert concentration["rule"] == "unparsed"
    assert concentration["children"][0]["rule"] == "all_of"
    depth = by_title["Depth (4 units)"]
    assert depth["rule"] == "group" and depth["children"][0]["courses"] == ["CS 171"]
    preparation = by_title["Preparation (7 units)"]
    assert preparation["rule"] == "all_of" and preparation["units"] == 7
    assert preparation["children"][0]["rule"] == "choose_courses"
    pool = by_title["Elective Pool (6 units)"]
    assert pool["rule"] == "unparsed" and pool["stated_units"] == [6, 6]

    assert program["warnings"] == []

    template = export_program(program)
    assert list(template) == [
        "catalog_id", "poid", "name", "degree", "pathway", "total_units", "source_url", "requirements", "roadmap",
    ]
    exported = {item["title"]: item for item in template["requirements"]}
    assert all(
        list(item) == ["title", "rule", "units", "min_grade", "courses", "source_text", "children"]
        for item in exported.values()
    )
    exported_core = exported["Lower Division Core (8 units)"]
    assert exported_core["rule"] == "all_of" and exported_core["units"] == 8
    assert exported_core["courses"] == ["BUS1 20"]
    assert exported_core["children"] == [{
        "title": "CS 46A or CS 46AX",
        "rule": "choose_courses",
        "units": 4,
        "min_grade": None,
        "courses": ["CS 46A", "CS 46AX"],
        "source_text": "CS 46A or CS 46AX",
        "children": [],
    }]
    assert exported["Elective Pool (6 units)"]["rule"] == "unparsed"
    assert exported["Elective Pool (6 units)"]["units"] == 6
    assert exported["Math (3 units)"]["rule"] == "choose_courses" and exported["Math (3 units)"]["units"] == 3
    assert exported["Plain List"]["rule"] == "choose_courses" and exported["Plain List"]["units"] == 3
    assert exported["Major Electives"]["courses"] == ["CS 132", "BIOL 132", "CS 151"]
    assert exported["Depth (4 units)"]["rule"] == "all_of" and exported["Depth (4 units)"]["courses"] == []
    assert template_coverage(template["requirements"]) == (12, 11)
    assert all(entry["kind"] != "unparsed" for term in template["roadmap"] for entry in term["items"])

    variable = classify({
        "title": "Literature (3-4 units)",
        "text": "Complete one course:",
        "items": [("course", [("ENGL 1", 3, 3)]), ("course", [("ENGL 2", 4, 4)])],
        "children": [],
    })
    assert variable["rule"] == "choose_courses" and export_requirement(variable)["rule"] == "unparsed"

    main_page = {**parse_program(SAMPLE_PAGE, "23", "1"), "name": "Art, BA", "roadmap": []}
    roadmap_page = {**parse_program(SAMPLE_PAGE, "23", "2"), "name": "Roadmap: Art, BA", "requirements": []}
    extra_page = {**parse_program(SAMPLE_PAGE, "23", "3"), "name": "Roadmap: Art, Painting Track, BA", "requirements": []}
    merged = merge_roadmaps([main_page, roadmap_page, extra_page])
    assert [item["name"] for item in merged] == ["Art, BA", "Art, Painting Track, BA"]
    assert merged[0]["poid"] == "1" and merged[0]["requirements"] and merged[0]["roadmap"]
    assert merged[1]["requirements"] == [] and merged[1]["warnings"]

    used: set[str] = set()
    assert program_filename("Art, Studio Practice (Teaching), BA", "1", used) == "art-studio-practice-teaching-ba.json"
    assert program_filename("Art: Studio Practice, Teaching, BA", "2", used) == "art-studio-practice-teaching-ba-2.json"

    with tempfile.TemporaryDirectory() as temporary:
        cache = Path(temporary) / "cache"
        cache.mkdir()
        (cache / "12345.html").write_text(SAMPLE_PAGE, encoding="utf-8")
        (cache / "_index_8470_1.html").write_text("<html></html>", encoding="utf-8")
        output_dir = Path(temporary) / "programs"
        write_programs(cache, "23", output_dir)
        assert [path.name for path in output_dir.iterdir()] == ["computer-science-bs.json"]
        written = json.loads((output_dir / "computer-science-bs.json").read_text(encoding="utf-8"))
        assert written == export_program(parse_program(SAMPLE_PAGE, "23", "12345"))

    fall, spring, third = program["roadmap"]
    assert (fall["year"], fall["term"]) == (1, "Fall")
    assert fall["items"] == [
        {"kind": "course", "code": "CS 46A"},
        {"kind": "ge", "area": "A1", "units": 3},
        {"kind": "elective", "units": 3},
        {"kind": "unparsed", "text": "See your advisor"},
    ]
    assert (spring["year"], spring["term"]) == (2, "Spring")
    assert spring["items"] == [
        {"kind": "course", "code": "CS 146"},
        {"kind": "course", "code": "PHYS 2A", "alternatives": ["PHYS 50"]},
    ]
    assert (third["year"], third["term"]) == (3, "Spring")
    assert third["items"] == [{"kind": "ge", "area": "1B", "units": 3}]

    assert extract_grade("Minimum grade of C- required.") == ("C-", "")
    assert extract_grade("A grade of B or better is required.") == ("B", "")
    assert extract_grade("Grade of C- in CS, grade of B in MATH.")[0] is None

    transfer = parse_program('<td class="block_content"><h1>Computer Science, BS, AS-T Transfer</h1></td>', "23", "1")
    assert transfer["pathway"] == "2-year"
    assert transfer["warnings"] == ["No div.acalog-core sections found on the page."]

    broken = parse_program("<html></html>", "23", "2")
    assert broken["requirements"] == [] and len(broken["warnings"]) == 2
    print("self-test passed", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse cached SJSU program pages into JSON.")
    parser.add_argument("--catoid", default="23", help="Catalog id to read from the cache.")
    parser.add_argument("--input-dir", type=Path, default=None, help="Cache folder. Default: utils/data/programs_raw/<catoid>.")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR, help="Folder for the program JSON files.")
    parser.add_argument("--self-test", action="store_true", help="Run offline checks and exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.self_test:
        self_test()
        return

    input_dir = args.input_dir or DATA_DIR / "programs_raw" / args.catoid
    if not input_dir.is_dir():
        raise SystemExit(f"Cache not found: {input_dir}. Run utils/program_scraping/fetch_programs.py first.")
    write_programs(input_dir, args.catoid, args.output)


if __name__ == "__main__":
    main()
