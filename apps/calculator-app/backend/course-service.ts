import catalog from "@/utils/data/course-sample.json";

export type CatalogCourse = (typeof catalog.courses)[number];

export function searchCourses(query: string): CatalogCourse[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return catalog.courses;

  return catalog.courses.filter((course) =>
    [course.code, course.subject, course.number, course.title, course.section]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function getCourseDetails(id: string) {
  return catalog.courses.find((course) => course.catalog_course_id === id);
}
