import { ExampleApp } from "@/apps/example/frontend";
import { isLocalPreview } from "@/utils/preview";
import { PreviewUnavailable } from "@/components/PreviewUnavailable";

export default function ExamplePage() {
  if (isLocalPreview()) return <PreviewUnavailable tool="Example app" />;
  return <ExampleApp />;
}
