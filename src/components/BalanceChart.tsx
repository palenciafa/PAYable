"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { BalanceHistoryPoint } from "@/types";
import { formatCurrency, formatDateShort } from "@/lib/utils";

export function BalanceChart({ points, friendName }: { points: BalanceHistoryPoint[]; friendName: string }) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        Add a transaction to see your balance history
      </div>
    );
  }

  const data = points.map((p) => ({ date: p.date, net: p.netCents / 100 }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₱${v}`}
        />
        <Tooltip
          formatter={(value: number) => [
            formatCurrency(Math.round(value * 100)),
            value >= 0 ? `${friendName} owes you` : "You owe",
          ]}
          labelFormatter={(label: string) => formatDateShort(label)}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
