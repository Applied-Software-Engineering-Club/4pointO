type CourseGrade = {
  courseName: string;
  semester: string;
  letterGrade: string;
  percentGrade: string;
};

const courses: CourseGrade[] = [
  {
    courseName: "CS 151",
    semester: "Fall 2026",
    letterGrade: "B+",
    percentGrade: "89.51%",
  },
  {
    courseName: "CS 160",
    semester: "Fall 2026",
    letterGrade: "B+",
    percentGrade: "89.51%",
  },
];

const columnClassName =
  "grid grid-cols-4 gap-2 whitespace-nowrap sm:gap-8";

export function GpaCalculator() {
  return (
    <main className="flex-1 bg-white px-6 py-6">
      <section aria-label="Course grades">
        <h1 className="text-lg font-semibold text-neutral-900">Courses</h1>
        <div
          className={`${columnClassName} mt-4 px-[13px] text-xs text-neutral-500 sm:px-[17px] sm:text-sm`}
        >
          <span>Course</span>
          <span>Semester</span>
          <span>Letter grade</span>
          <span>Percent grade</span>
        </div>
        <ul className="mt-2 flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={`${course.courseName}-${course.semester}`}
              className={`${columnClassName} rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-900 sm:p-4 sm:text-base`}
            >
              <span>{course.courseName}</span>
              <span>{course.semester}</span>
              <span>{course.letterGrade}</span>
              <span>{course.percentGrade}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
