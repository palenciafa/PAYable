"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { AppUser, Category } from "@/types";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

export function TransactionFilters({
  categories,
  users,
  currentUser,
}: {
  categories: Category[];
  users: AppUser[];
  currentUser: AppUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <Input
        placeholder="Search transactions…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          updateParam("q", e.target.value);
        }}
        className="sm:max-w-xs"
      />
      <Select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        className="sm:w-44"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </Select>
      <Select
        value={searchParams.get("paidBy") ?? ""}
        onChange={(e) => updateParam("paidBy", e.target.value)}
        className="sm:w-40"
      >
        <option value="">Anyone paid</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === currentUser.id ? "You" : u.name} paid
          </option>
        ))}
      </Select>
      <Select
        value={searchParams.get("from") ? "custom" : searchParams.get("range") ?? ""}
        onChange={(e) => updateParam("range", e.target.value)}
        className="sm:w-36"
      >
        <option value="">All time</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="month">This month</option>
      </Select>
    </div>
  );
}
