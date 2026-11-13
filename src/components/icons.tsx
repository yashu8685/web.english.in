import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "home"
  | "cards"
  | "lessons"
  | "flame"
  | "spark"
  | "arrow-right"
  | "arrow-left"
  | "check"
  | "close"
  | "menu"
  | "logout"
  | "search"
  | "volume"
  | "mic"
  | "headphones"
  | "chat"
  | "target"
  | "clock"
  | "trophy"
  | "alert"
  | "refresh"
  | "trash";

const paths: Record<IconName, ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5.25 9.75V21h13.5V9.75M9.75 21v-6h4.5v6" />
  ),
  cards: (
    <>
      <rect x="3" y="6" width="13" height="15" rx="2.5" />
      <path d="M8 3h10.5A2.5 2.5 0 0 1 21 5.5V17" />
    </>
  ),
  lessons: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </>
  ),
  flame: (
    <path d="M12 22c4 0 6.5-2.6 6.5-6.2 0-4.4-3.3-6.5-4.3-9.8-.2-.7-1-1-1.5-.5-1.6 1.6-2.4 3.6-2.4 5.4 0 .7-.8 1-1.3.6-.7-.6-1.1-1.4-1.3-2.2-.2-.7-1-.9-1.4-.3C5.4 10.6 5 12.4 5 14.3 5 19 8 22 12 22Z" />
  ),
  spark: (
    <path d="M12 2.5 13.9 9l6.6 1.9-6.6 1.9L12 19.4l-1.9-6.6L3.5 10.9 10.1 9 12 2.5Z" />
  ),
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6 6-6-6 6-6" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />,
  logout: <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h11" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  volume: <path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm5 2.5a6 6 0 0 1 0 9M19.5 4a10 10 0 0 1 0 16" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13" width="4.5" height="7" rx="2" />
      <rect x="17" y="13" width="4.5" height="7" rx="2" />
    </>
  ),
  chat: (
    <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 3 1.3-4.6A7.5 7.5 0 1 1 21 11.5Z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trophy: (
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 1.5H4.5V7A3.5 3.5 0 0 0 8 10.5m8-5h3.5V7A3.5 3.5 0 0 1 16 10.5M12 13v4m-3 4h6m-6 0a3 3 0 0 1 3-3 3 3 0 0 1 3 3" />
  ),
  alert: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 9.5V14M12 17.2v.3" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5" />,
  trash: (
    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5" />
  )
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
