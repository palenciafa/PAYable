import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { AppUser } from "@/types";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/payments", label: "Payments" },
  { href: "/analytics", label: "Analytics" },
];

export function Navbar({ currentUser }: { currentUser: AppUser | null }) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            ₱
          </span>
          PAYable
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {currentUser && (
            <span className="hidden text-sm text-slate-500 sm:inline">{currentUser.name}</span>
          )}
          <form action={logout}>
            <button
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 active:bg-slate-200"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
