import Link from "next/link";

export function PreviewUnavailable({ tool }: { tool: string }) {
  return <main className="tool-page"><section className="preview-unavailable">
    <span className="eyebrow">Local demo preview</span>
    <h1>{tool}</h1>
    <p>This tool needs your development Supabase connection. It is unavailable in the isolated preview, so no account or database requests are made.</p>
    <p>You can try the sample GPA calculator, or explore the calendar and assignments on the dashboard.</p>
    <div className="button-row"><Link className="button dark" href="/">Back to dashboard</Link><Link className="button" href="/gpa-calc">Try sample GPA</Link></div>
  </section></main>;
}
