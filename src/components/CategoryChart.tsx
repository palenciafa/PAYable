"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryTotal } from "@/types";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#64748b"];

export function CategoryChart({ totals }: { totals: CategoryTotal[] }) {
  const data = totals
    .filter((t) => t.totalCents > 0)
    .map((t) => ({ name: `${t.category.icon} ${t.category.name}`, value: t.totalCents / 100 }));

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No spending yet this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(Math.round(value * 100))} />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
