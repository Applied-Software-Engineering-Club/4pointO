type GpaResultsProps = {
  semesterLabel: string;
  semesterGpa: number | null;
  semesterUnits: number;
  cgpa: number | null;
  totalUnits: number;
};

const MAX_GPA = 4;

function formatGpa(gpa: number | null) {
  if (gpa === null) {
    return "N/A";
  }
  return gpa.toFixed(2);
}

type ResultCardProps = {
  title: string;
  gpa: number | null;
  units: number;
};

function ResultCard({ title, gpa, units }: ResultCardProps) {
  const percent = gpa === null ? 0 : Math.min(gpa / MAX_GPA, 1) * 100;

  return (
    <div className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-neutral-900">
        {formatGpa(gpa)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {units} {units === 1 ? "unit" : "units"} included
      </p>

      <div
        role="meter"
        aria-label={`${title} on a 0 to 4.0 scale`}
        aria-valuemin={0}
        aria-valuemax={MAX_GPA}
        aria-valuenow={gpa ?? 0}
        aria-valuetext={formatGpa(gpa)}
        className="mt-4 h-2 w-full rounded-full bg-neutral-200"
      >
        <div
          className="h-2 rounded-full bg-neutral-900"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className="mt-1 flex justify-between text-xs text-neutral-500"
        aria-hidden="true"
      >
        <span>0.0</span>
        <span>1.0</span>
        <span>2.0</span>
        <span>3.0</span>
        <span>4.0</span>
      </div>
    </div>
  );
}

export function GpaResults({
  semesterLabel,
  semesterGpa,
  semesterUnits,
  cgpa,
  totalUnits,
}: GpaResultsProps) {
  return (
    <section aria-label="GPA results" className="mt-8">
      <h2 className="text-lg font-semibold text-neutral-900">Results</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ResultCard
          title={`${semesterLabel} GPA`}
          gpa={semesterGpa}
          units={semesterUnits}
        />
        <ResultCard
          title="Cumulative GPA (CGPA)"
          gpa={cgpa}
          units={totalUnits}
        />
      </div>
    </section>
  );
}