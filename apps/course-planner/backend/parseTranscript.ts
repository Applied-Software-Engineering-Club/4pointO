export type TranscriptCourse = {
  code: string;
  title: string;
  units: string;
  letterGrade: string;
  points: string;
  season: string;
  year: string;
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
  /^(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|CR|NC|WU|W|I|P|NP|AU|RP)$/i;
const numberToken = /^\d+(?:\.\d+)?$/;

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
  const match = line.match(/^([A-Z]{2,5})\s+(\d{1,3}[A-Z]?)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const tokens = clean(match[3]).split(" ");
  const count = tokens.length;
  const title = (end: number) => clean(tokens.slice(0, end).join(" "));
  let parsed: { title: string; units: string; letterGrade: string; points: string } | null =
    null;

  // Attempted, earned, GPA units, grade, and optional grade points.
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
    code: `${match[1]} ${match[2]}`,
    ...parsed,
  };
}

export function parseTranscriptText(text: string): TranscriptCourse[] {
  const courses: TranscriptCourse[] = [];
  let term: { season: string; year: string } | null = null;

  for (const rawLine of text.normalize("NFKC").split(/\r?\n/)) {
    const line = clean(rawLine);
    if (!line) {
      continue;
    }

    const nextTerm = readTerm(line);
    if (nextTerm && !/^[A-Z]{2,5}\s+\d{1,3}[A-Z]?\b/.test(line)) {
      term = nextTerm;
      continue;
    }

    const course = readCourse(line);
    if (!course || !term) {
      continue;
    }

    courses.push({ ...course, season: term.season, year: term.year });
  }

  return courses;
}
