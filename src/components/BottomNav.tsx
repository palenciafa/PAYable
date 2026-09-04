"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.4 : 1.8} stroke="currentColor" className="h-6 w-6">
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Activity",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.4 : 1.8} stroke="currentColor" className="h-6 w-6">
        <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L15 18.5l-3 2-3-2-3.5 2.5V5A1.5 1.5 0 0 1 7 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/payments",
    label: "Payments",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.4 : 1.8} stroke="currentColor" className="h-6 w-6">
        <rect x="2.5" y="6" width="19" height="13" rx="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 10.5h19" strokeLinecap="round" />
        <path d="M6 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.4 : 1.8} stroke="currentColor" className="h-6 w-6">
        <path d="M4 20V10.5M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/**
 * iOS-style fixed bottom tab bar, shown only below the `sm` breakpoint
 * (the desktop Navbar carries the same links above that). Padded for the
 * home-indicator safe area on notched iPhones via `pb-safe` (globals.css).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-brand-600" : "text-slate-400"
              }`}
            >
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
