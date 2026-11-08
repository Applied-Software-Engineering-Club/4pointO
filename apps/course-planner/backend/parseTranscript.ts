export type TranscriptCourse = {
  code: string;
  title: string;
  units: string;
  letterGrade: string;
  points: string;
  season: string;
  year: string;
  attemptedUnits: string;
  gpaUnits: string;
  earnedUnits: string;
};

export type ExternalCredit = {
  source: string;
  units: number;
  season: string;
  year: string;
};

export type ParsedTranscript = {
  courses: TranscriptCourse[];
  externalCredits: ExternalCredit[];
};

const seasonNames: Record<string, string> = {
  fall: "Fall",
  spring: "Spring",
  summer: "Summer",
  winter: "Winter",
  fa: "Fall",
  sp: "Spring",
  su: "Summer",
  wi: "Winter",
};

const gradeToken =
  /^(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|CR|NC|WU|W|I|IC|P|NP|AU|RP|RD|IP)$/i;
const numberToken = /^\d+(?:\.\d+)?$/;
const courseLine = /^([A-Z]{2,5}\d?)\s+(\d{1,3}[A-Z]*)\s+(.+)$/;
const externalHeading = /^EXTERNAL CREDIT\s+UE\b/i;
const externalLine =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(FALL|SPRING|SUMMER|WINTER)\s+((?:19|20)\d{2})(?:\s+\S+)?$/i;

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function formatUnits(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }
  return String(amount);
}

function readTerm(line: string) {
  const seasonFirst = line.match(
    /\b(fall|spring|summer|winter|fa|sp|su|wi)\b(?:\s+(?:semester|quarter|term|session))?\s+((?:19|20)\d{2})\b/i,
  );
  if (seasonFirst) {
    return {
      season: seasonNames[seasonFirst[1].toLowerCase()],
      year: seasonFirst[2],
    };
  }

  const yearFirst = line.match(
    /\b((?:19|20)\d{2})\s+(fall|spring|summer|winter)\b(?:\s+(?:semester|quarter|term))?/i,
  );
  if (yearFirst) {
    return {
      season: seasonNames[yearFirst[2].toLowerCase()],
      year: yearFirst[1],
    };
  }

  return null;
}

function isGrade(token: string) {
  return gradeToken.test(token);
}

function isNumber(token: string) {
  return numberToken.test(token);
}

function readCourse(line: string) {
  const match = line.match(courseLine);
  if (!match) {
    return null;
  }

  const tokens = clean(match[3]).split(" ");
  const count = tokens.length;
  const title = (end: number) => clean(tokens.slice(0, end).join(" "));
  let parsed: {
    title: string;
    units: string;
    letterGrade: string;
    points: string;
    attemptedUnits?: string;
    gpaUnits?: string;
    earnedUnits?: string;
  } | null = null;

  // MySJSU columns: UA (attempted), UG (GPA), UE (earned), grade, optional points.
  if (
    count >= 6 &&
    isNumber(tokens[count - 1]) &&
    isGrade(tokens[count - 2]) &&
    isNumber(tokens[count - 3]) &&
    isNumber(tokens[count - 4]) &&
    isNumber(tokens[count - 5])
  ) {
    parsed = {
      title: title(count - 5),
      units: formatUnits(tokens[count - 3]),
      letterGrade: tokens[count - 2].toUpperCase(),
      points: formatUnits(tokens[count - 1]),
      attemptedUnits: formatUnits(tokens[count - 5]),
      gpaUnits: formatUnits(tokens[count - 4]),
      earnedUnits: formatUnits(tokens[count - 3]),
    };
  } else if (
    count >= 5 &&
    isGrade(tokens[count - 1]) &&
    isNumber(tokens[count - 2]) &&
    isNumber(tokens[count - 3]) &&
    isNumber(tokens[count - 4])
  ) {
    parsed = {
      title: title(count - 4),
      units: formatUnits(tokens[count - 2]),
      letterGrade: tokens[count - 1].toUpperCase(),
      points: "",
      attemptedUnits: formatUnits(tokens[count - 4]),
      gpaUnits: formatUnits(tokens[count - 3]),
      earnedUnits: formatUnits(tokens[count - 2]),
    };
  } else if (
    count >= 4 &&
    isNumber(tokens[count - 1]) &&
    isGrade(tokens[count - 2]) &&
    isNumber(tokens[count - 3])
  ) {
    parsed = {
      title: title(count - 3),
      units: formatUnits(tokens[count - 3]),
      letterGrade: tokens[count - 2].toUpperCase(),
      points: formatUnits(tokens[count - 1]),
    };
  } else if (count >= 3 && isGrade(tokens[count - 1]) && isNumber(tokens[count - 2])) {
    parsed = {
      title: title(count - 2),
      units: formatUnits(tokens[count - 2]),
      letterGrade: tokens[count - 1].toUpperCase(),
      points: "",
    };
  } else if (count >= 3 && isNumber(tokens[count - 1]) && isGrade(tokens[count - 2])) {
    parsed = {
      title: title(count - 2),
      units: formatUnits(tokens[count - 1]),
      letterGrade: tokens[count - 2].toUpperCase(),
      points: "",
    };
  }

  if (!parsed?.title) {
    return null;
  }

  return {
    attemptedUnits: "",
    gpaUnits: "",
    earnedUnits: "",
    code: `${match[1]} ${match[2]}`,
    ...parsed,
  };
}

export function parseTranscript(text: string): ParsedTranscript {
  const courses: TranscriptCourse[] = [];
  const externalCredits: ExternalCredit[] = [];
  const seen = new Set<string>();
  let term: { season: string; year: string } | null = null;
  let inExternalSection = false;

  for (const rawLine of text.normalize("NFKC").split(/\r?\n/)) {
    const line = clean(rawLine);
    if (!line) {
      continue;
    }

    if (externalHeading.test(line)) {
      inExternalSection = true;
      continue;
    }
    if (inExternalSection) {
      const external = line.match(externalLine);
      if (external) {
        externalCredits.push({
          source: external[1],
          units: Number(external[2]),
          season: seasonNames[external[3].toLowerCase()],
          year: external[4],
        });
        continue;
      }
      inExternalSection = false;
    }

    const nextTerm = readTerm(line);
    if (nextTerm && !courseLine.test(line)) {
      term = nextTerm;
      continue;
    }

    const course = readCourse(line);
    if (!course || !term) {
      continue;
    }

    // A PDF page break can repeat a row, which is not a second attempt.
    const key = [term.season, term.year, course.code, course.letterGrade].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    courses.push({ ...course, season: term.season, year: term.year });
  }

  return { courses, externalCredits };
}

export function parseTranscriptText(text: string): TranscriptCourse[] {
  return parseTranscript(text).courses;
}
