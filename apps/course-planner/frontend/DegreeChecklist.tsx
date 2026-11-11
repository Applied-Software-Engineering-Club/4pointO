import type {
  AuditResult,
  AuditStatus,
  RequirementResult,
} from "@/apps/course-planner/backend/degreeAudit";

const statusLabel: Record<AuditStatus, string> = {
  met: "Done",
  in_progress: "In progress",
  unmet: "Not done",
  manual_check: "Check manually",
};

const statusClassName: Record<AuditStatus, string> = {
  met: "text-green-700",
  in_progress: "text-amber-700",
  unmet: "text-neutral-500",
  manual_check: "text-neutral-500",
};

function UnitsBar({ completed, required }: { completed: number; required: number }) {
  const percent = required > 0 ? Math.min(completed / required, 1) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={required}
      aria-valuenow={Math.min(completed, required)}
      aria-valuetext={`${completed} of ${required} units`}
      className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200"
    >
      <div className="h-full rounded-full bg-neutral-900" style={{ width: `${percent}%` }} />
    </div>
  );
}

function CheckItem({ code, done, note }: { code: string; done: boolean; note?: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
          done ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className="sr-only">{done ? "Completed: " : "Not completed: "}</span>
      <span className={done ? "text-neutral-900" : "text-neutral-600"}>{code}</span>
      {note ? <span className="text-xs text-amber-700">{note}</span> : null}
    </li>
  );
}

function RequirementSection({
  requirement,
  depth,
}: {
  requirement: RequirementResult;
  depth: number;
}) {
  const Heading = depth === 0 ? "h3" : "h4";
  const hasCourses =
    requirement.appliedCourses.length > 0 || requirement.missingCourses.length > 0;

  return (
    <div className={depth === 0 ? "rounded-xl border border-neutral-200 bg-neutral-50 p-4" : ""}>
      <div className="flex items-start justify-between gap-3">
        <Heading className="text-sm font-semibold text-neutral-900">{requirement.title}</Heading>
        <span
          className={`shrink-0 text-xs font-medium ${statusClassName[requirement.status]}`}
        >
          {statusLabel[requirement.status]}
        </span>
      </div>

      {requirement.unitsRequired ? (
        <>
          <p className="mt-1 text-xs text-neutral-500">
            {requirement.unitsCompleted} / {requirement.unitsRequired} units
          </p>
          <UnitsBar completed={requirement.unitsCompleted} required={requirement.unitsRequired} />
        </>
      ) : null}

      {hasCourses ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {requirement.appliedCourses.map((course) => (
            <CheckItem
              key={`applied-${course.code}`}
              code={course.code}
              done={!course.inProgress}
              note={course.inProgress ? "In progress" : undefined}
            />
          ))}
          {requirement.missingCourses.map((code) => (
            <CheckItem key={`missing-${code}`} code={code} done={false} />
          ))}
        </ul>
      ) : null}

      {!hasCourses && requirement.children.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">Check this requirement in the SJSU catalog.</p>
      ) : null}

      {requirement.children.length > 0 ? (
        <div className="mt-3 flex flex-col gap-4 border-l border-neutral-200 pl-4">
          {requirement.children.map((child, index) => (
            <RequirementSection
              key={`${index}-${child.title}`}
              requirement={child}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DegreeChecklist({ audit }: { audit: AuditResult }) {
  const { required, completed, inProgress } = audit.totalUnits;

  return (
    <section aria-label="Degree progress" className="mt-8 max-w-3xl">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Degree progress</h2>
        <a
          href={audit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-500 underline hover:text-neutral-900"
        >
          {audit.programName}
        </a>
      </div>

      {required ? (
        <div className="mt-3">
          <p className="text-xs text-neutral-500">
            {completed} / {required} units
            {inProgress > 0 ? ` (+${inProgress} in progress)` : ""}
          </p>
          <UnitsBar completed={completed} required={required} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {audit.requirements.map((requirement, index) => (
          <RequirementSection
            key={`${index}-${requirement.title}`}
            requirement={requirement}
            depth={0}
          />
        ))}
      </div>
    </section>
  );
}