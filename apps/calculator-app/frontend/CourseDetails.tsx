import type { CatalogCourse } from "../backend/course-service";

type CourseDetailsProps = {
  course: CatalogCourse;
};

function formatUnits(min: number, max: number) {
  if (min === max) {
    return `${min} ${min === 1 ? "unit" : "units"}`;
  }
  return `${min}–${max} units`;
}

type DetailRowProps = {
  label: string;
  value: string | null;
};

function DetailRow({ label, value }: DetailRowProps) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

export function CourseDetails({ course }: CourseDetailsProps) {
  return (
    <article
      aria-label={`${course.code} details`}
      className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
    >
      <p className="text-sm font-medium text-neutral-500">{course.code}</p>
      <h3 className="mt-1 text-base font-semibold text-neutral-900">
        {course.title}
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        {formatUnits(course.units_min, course.units_max)}
      </p>

      <p className="mt-3 text-sm text-neutral-700">
        {course.description || "No description available."}
      </p>

      <dl className="mt-4 flex flex-col gap-3">
        <DetailRow label="Department" value={course.section} />
        <DetailRow label="Grading" value={course.grading} />
        <DetailRow label="Prerequisites" value={course.prerequisites} />
        <DetailRow label="Corequisites" value={course.corequisites} />
        <DetailRow label="Notes" value={course.notes} />
      </dl>

      {course.source_url ? (
        <a
          href={course.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-medium text-neutral-900 underline hover:text-neutral-600"
        >
          View in SJSU catalog
        </a>
      ) : null}
    </article>
  );
}
