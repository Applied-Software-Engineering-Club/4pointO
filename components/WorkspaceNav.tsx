"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function WorkspaceNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = pathname === "/" ? params.get("view") ?? "overview" : "academic";
  return <nav className="workspace-tabs" aria-label="Workspace">
    {["Overview", "Academic", "Personal"].map((label) => <Link key={label} href={label === "Overview" ? "/" : `/?view=${label.toLowerCase()}`} aria-current={selected === label.toLowerCase() ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
