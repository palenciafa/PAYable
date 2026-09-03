"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/utils";

export function MonthPicker({ month, options }: { month: string; options: string[] }) {
  const router = useRouter();

  return (
    <select
      value={month}
      onChange={(e) => router.push(`/analytics?month=${e.target.value}`)}
      className="input w-auto"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}
