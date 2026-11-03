import { Dashboard } from "@/components/dashboard/Dashboard";
import { loadDashboard } from "@/components/dashboard/load";
import { isLocalPreview } from "@/utils/preview";
import { demoDashboard } from "@/utils/demo/fixtures";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const view = params.view === "academic" || params.view === "personal" ? params.view : "overview";
  const preview = isLocalPreview();
  const data = preview ? demoDashboard : await loadDashboard();
  return <Dashboard key={view} data={data} preview={preview} view={view} />;
}
