import { listUserCourses } from "@/apps/calculator-app/backend/courses/listUserCourses";
import { GpaCalculator } from "@/apps/calculator-app/frontend";

export default async function GpaCalcPage() {
  const courses = await listUserCourses();
  return <GpaCalculator courses={courses} />;
}
