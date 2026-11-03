import { SyllabusTracker } from "@/apps/syllabus-tracker/frontend";
import { isLocalPreview } from "@/utils/preview";
import { PreviewUnavailable } from "@/components/PreviewUnavailable";

export default async function SyllabusTrackerPage({ searchParams }: PageProps<"/syllabus-tracker">) {
  if (isLocalPreview()) return <PreviewUnavailable tool="Courses, syllabus & calendar" />;
  const { tab } = await searchParams;
  const initialTab = tab === "calendar" ? "Calendar" : tab === "grades" ? "Grade Calc" : "Main";
  return <SyllabusTracker key={initialTab} initialTab={initialTab} />;
}
