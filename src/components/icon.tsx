import type { CSSProperties } from "react";

type IconName = "arrow" | "calendar" | "check" | "chevron" | "download" | "lock" | "minus" | "plus" | "users" | "spark";
const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  users: <><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-8a5 5 0 0 1 4 5v3" /><circle cx="9" cy="6" r="4" /><path d="M17 3a4 4 0 0 1 0 7" /></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>,
};

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
