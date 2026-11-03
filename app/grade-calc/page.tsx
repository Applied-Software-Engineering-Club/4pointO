import { redirect } from "next/navigation";
import { isLocalPreview } from "@/utils/preview";
import { PreviewUnavailable } from "@/components/PreviewUnavailable";

export default function GradeCalcPage() {
  if (isLocalPreview()) return <PreviewUnavailable tool="Course grade calculator" />;
  redirect("/syllabus-tracker?tab=grades");
}
