import { listUserCourses } from "@/apps/calculator-app/backend/courses/listUserCourses";
import { GpaCalculator } from "@/apps/calculator-app/frontend";
import { isLocalPreview } from "@/utils/preview";
import { demoGpaCourses } from "@/utils/demo/fixtures";

export const dynamic = "force-dynamic";

export default async function GpaCalcPage() {
  if (isLocalPreview()) return <GpaCalculator courses={demoGpaCourses} preview />;
  const courses = await listUserCourses();
  return <GpaCalculator courses={courses} />;
}
