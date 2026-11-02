"""Extract administrative information from an SJSU syllabus PDF.

The output matches the syllabus-relevant fields in the Supabase user-courses table.
Course-content sections such as textbooks, chapters, lecture topics, assignments,
and grading policies are intentionally excluded.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Iterable

OUTPUT_FIELDS = (
    "course", "term", "units", "instructors", "meeting_times", "location",
    "office", "office_hours", "email", "phone", "prerequisites", "important_dates",
)
LABELS = {
    "course": r"course(?: title| name)?|class",
    "term": r"term|semester",
    "units": r"units?|credits?",
    "instructors": r"instructor(?:s)?|professor(?:s)?|faculty",
    "meeting_times": r"(?:class|course) (?:meeting(?: time)?s?|timing)|meeting times?|schedule|time",
    "location": r"(?:class )?location|room|classroom",
    "office": r"office(?: location)?|faculty office",
    "office_hours": r"office hours?|student hours?|availability",
    "email": r"e[- ]?mail|email address",
    "phone": r"(?:phone|telephone|tel(?:ephone)?)(?: number)?",
    "prerequisites": r"prerequisite(?:\(s\)|s)?|required background",
}
LABEL_RE = re.compile(
    r"^\s*(?P<label>" + "|".join(f"(?:{value})" for value in LABELS.values()) + r")\s*[:\-–]\s*(?P<value>.+?)\s*$",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}")
DATE_RE = re.compile(
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b", re.IGNORECASE,
)
SECTION_RE = re.compile(
    r"^(?:table of contents|course (?:content|schedule|outline)|reading(?:s)?|"
    r"textbooks?|required materials?|assignments?|grading|lecture topics?|"
    r"weekly schedule|academic integrity|accommodations?)\s*:?[\s]*$", re.IGNORECASE,
)


def clean(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip(" \t:;,-–")


def canonical_label(label: str) -> str | None:
    normalized = clean(label).lower()
    for field, pattern in LABELS.items():
        if re.fullmatch(pattern, normalized, re.IGNORECASE):
            return field
    return None


def read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise SystemExit("Missing dependency: install with python -m pip install -r utils/requirements.txt.") from exc
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _add(result: dict[str, list[str]], field: str, value: str) -> None:
    value = clean(value)
    if value and value.lower() not in {item.lower() for item in result[field]}:
        result[field].append(value)


def _label_value_lines(lines: Iterable[str]) -> dict[str, list[str]]:
    result = {field: [] for field in OUTPUT_FIELDS}
    pending: str | None = None
    for raw_line in lines:
        line = clean(raw_line)
        if not line:
            continue
        if SECTION_RE.fullmatch(line):
            pending = None
            continue
        match = LABEL_RE.match(line)
        if match:
            pending = canonical_label(match.group("label"))
            if pending:
                _add(result, pending, match.group("value"))
            continue
        if (
            pending and len(line) <= 180 and ":" not in line
            and not re.search(r"[.!?]$", line)
            and not re.search(r"important dates?|key dates?|calendar|holidays?", line, re.IGNORECASE)
            and not re.search(r"\b(?:information|contact|course|section|instructor|email|location|office)\b", line, re.IGNORECASE)
        ):
            _add(result, pending, line)
        else:
            pending = None
    return result


def _first(result: dict[str, list[str]], field: str) -> str:
    values = result.get(field) or []
    return values[0] if values else ""


def _time_range(value: str) -> tuple[str, str, str]:
    """Split a syllabus time such as T-Th (4:30-5:45 pm)."""
    match = re.search(
        r"(?P<days>[A-Za-z]+(?:\s*(?:[-/&]|and)\s*[A-Za-z]+)+).*?"
        r"(?P<start>\d{1,2}:\d{2})\s*[-–]\s*(?P<end>\d{1,2}:\d{2})\s*(?P<ampm>[ap]m)?",
        value, re.IGNORECASE,
    )
    if not match:
        return "", "", ""

    def clock(raw: str, ampm: str) -> str:
        hour, minute = (int(part) for part in raw.split(":", 1))
        if ampm.lower() == "pm" and hour != 12:
            hour += 12
        if ampm.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"

    ampm = match.group("ampm") or "am"
    return match.group("days"), clock(match.group("start"), ampm), clock(match.group("end"), ampm)


def to_user_course_fields(result: dict[str, list[str]]) -> dict[str, str]:
    """Map extracted values to Supabase user-courses draft fields."""
    course = _first(result, "course")
    course_match = re.match(r"(?P<name>.+?)\s*\((?P<number>[A-Z]{2,5}\s*\d{1,3}[A-Z]?)\)$", course)
    if course_match:
        course_name = course_match.group("name").strip()
        course_number = course_match.group("number")
    else:
        course_match = re.match(r"(?P<number>[A-Z]{2,5}\s*\d{1,3}[A-Z]?)\s+(?P<name>.+)$", course)
        if course_match:
            course_number = course_match.group("number")
            course_name = course_match.group("name").strip()
        else:
            course_name, course_number = course, ""

    days, start, end = _time_range(_first(result, "meeting_times"))
    office_days, office_start, office_end = _time_range(_first(result, "office_hours"))
    return {
        "course_number": course_number,
        "course_name": course_name,
        "course_days": days,
        "course_start": start,
        "course_end": end,
        "office_hours_days": office_days,
        "office_hours_start": office_start,
        "office_hours_end": office_end,
        "professor_name": _first(result, "instructors"),
        "professor_email": _first(result, "email"),
        "prerequisites": _first(result, "prerequisites"),
    }


def parse_syllabus_text(text: str) -> dict[str, str]:
    lines = [line for line in re.split(r"\r?\n", text) if clean(line)]
    result = _label_value_lines(lines)
    joined = "\n".join(lines)
    for email in EMAIL_RE.findall(joined):
        _add(result, "email", email)
    for phone in PHONE_RE.findall(joined):
        _add(result, "phone", phone)

    for index, line in enumerate(lines):
        code = re.search(r"\b([A-Z]{2,5}\s*\d{1,3}[A-Z]?)\b", line)
        term = re.search(r"\b(Spring|Summer|Fall|Winter)\s+\d{4}\b", line, re.IGNORECASE)
        units = re.search(r"\b(\d+(?:\.\d+)?)\s+Units?\b", line, re.IGNORECASE)
        if code and (term or units):
            title = re.split(r"\b" + re.escape(code.group(1)) + r"\b", line, maxsplit=1)[0].strip(" -")
            _add(result, "course", f"{title} ({code.group(1)})" if title else code.group(1))
        elif (
            code and index > 0 and index + 1 < len(lines)
            and re.search(r"\b(?:Spring|Summer|Fall|Winter)\s+\d{4}\b", lines[index + 1], re.IGNORECASE)
            and len(lines[index - 1]) <= 100
        ):
            previous = lines[index - 1]
            if not re.search(r"\b(?:contact|information|section|unit|fall|spring|summer|winter)\b", previous, re.IGNORECASE):
                _add(result, "course", f"{previous} ({code.group(1)})")
    return to_user_course_fields(result)


def self_test() -> None:
    sample = """
    Course: CS 146 Data Structures and Algorithms
    Instructor: Ada Lovelace
    Email: ada.lovelace@sjsu.edu
    Office Hours: Tuesday and Thursday, 2:00-3:00 PM
    Class Meeting Times: Monday and Wednesday, 10:30-11:45 AM
    Required Textbook: Do not include this
    Week 1: chapter 1
    """
    parsed = parse_syllabus_text(sample)
    assert parsed["professor_email"] == "ada.lovelace@sjsu.edu"
    assert parsed["course_number"] == "CS 146"
    assert parsed["course_start"] == "10:30" and parsed["course_end"] == "11:45"
    assert "Required Textbook" not in json.dumps(parsed)
    assert "chapter 1" not in json.dumps(parsed)
    print("self-test passed", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract administrative fields from an SJSU syllabus PDF.")
    parser.add_argument("pdf", type=Path, nargs="?", help="Syllabus PDF to parse.")
    parser.add_argument("--output", type=Path, help="Write JSON to this path instead of stdout.")
    parser.add_argument("--self-test", action="store_true", help="Run parser checks against sample text.")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.pdf is None:
        raise SystemExit("Provide a syllabus PDF or use --self-test.")
    if not args.pdf.is_file():
        raise SystemExit(f"PDF not found: {args.pdf}")
    payload = json.dumps(parse_syllabus_text(read_pdf(args.pdf)), indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
