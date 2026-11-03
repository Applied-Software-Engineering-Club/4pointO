export type IconName = "book" | "check" | "calendar" | "note" | "degree" | "timer" | "widgets" | "sliders" | "arrow" | "close" | "play" | "pause" | "reset" | "search";
const paths: Record<IconName, React.ReactNode> = {
  book: <><path d="M12 5c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v14"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1m4 0h1"/></>,
  note: <><path d="M15 4H6a2 2 0 0 0-2 2v14h14v-9M2 8h4m-4 5h4m-4 5h4m3-4 2-5 7-7 3 3-7 7-5 2Z"/></>,
  degree: <><path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v7c4 3 8 3 12 0v-7m4-2v8"/></>,
  timer: <><circle cx="12" cy="14" r="8"/><path d="M9 2h6m-3 4V3m6 4 2-2m-8 9 3-4"/></>,
  widgets: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M10 9v12"/></>,
  sliders: <><path d="M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6M9 15v6"/></>,
  arrow: <path d="M6 18 18 6M7 6h11v11"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  play: <path d="m9 5 11 7-11 7V5Z"/>,
  pause: <path d="M8 5v14M16 5v14"/>,
  reset: <><path d="M3 11a9 9 0 1 1 2 9M3 5v6h6"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
};
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
