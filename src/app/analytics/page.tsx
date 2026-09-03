import { redirect } from "next/navigation";
import {
  getAllUsers,
  getCategories,
  getCurrentAppUser,
  getRawPayments,
  getTransactions,
} from "@/lib/data/queries";
import {
  calculateBalanceHistory,
  calculateCategoryTotals,
  calculateMonthlySummary,
} from "@/lib/balance";
import { formatCurrency, todayISO } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { CategoryChart } from "@/components/CategoryChart";
import { BalanceChart } from "@/components/BalanceChart";
import { MonthPicker } from "@/components/MonthPicker";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);
  if (!otherUser) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Add a second user to see analytics.</p>
      </Card>
    );
  }

  const [transactions, payments, categories] = await Promise.all([
    getTransactions(),
    getRawPayments(),
    getCategories(),
  ]);

  const params = await searchParams;
  const monthsAvailable = Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));
  const currentMonth = todayISO().slice(0, 7);
  if (!monthsAvailable.includes(currentMonth)) monthsAvailable.unshift(currentMonth);

  const month = params.month && monthsAvailable.includes(params.month) ? params.month : currentMonth;

  const summary = calculateMonthlySummary(transactions, payments, currentUser.id, otherUser.id, month);
  const monthTxns = transactions.filter((t) => t.date.startsWith(month));
  const categoryTotals = calculateCategoryTotals(monthTxns, categories);
  const history = calculateBalanceHistory(transactions, payments, currentUser.id, otherUser.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <MonthPicker month={month} options={monthsAvailable} />
      </div>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Monthly summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Total shared expenses" value={formatCurrency(summary.totalExpensesCents)} />
          <Stat label="You paid" value={formatCurrency(summary.paidByMeCents)} />
          <Stat label={`${otherUser.name} paid`} value={formatCurrency(summary.paidByFriendCents)} />
          <Stat label="Payments made" value={formatCurrency(summary.paymentsCents)} />
          <Stat label={`${otherUser.name} owes you`} value={formatCurrency(summary.friendOwesMeCents)} tone="owed" />
          <Stat label="You owe" value={formatCurrency(summary.iOweFriendCents)} tone="owe" />
          <Stat
            label="Net for this month"
            value={
              summary.netCents === 0
                ? "Settled"
                : `${summary.netCents > 0 ? otherUser.name + " owes you" : "You owe"} ${formatCurrency(Math.abs(summary.netCents))}`
            }
            tone={summary.netCents > 0 ? "owed" : summary.netCents < 0 ? "owe" : undefined}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">Spending by category</h2>
          <CategoryChart totals={categoryTotals} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">Balance history (all time)</h2>
          <BalanceChart points={history} friendName={otherUser.name} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">Category breakdown</h2>
        <div className="space-y-2">
          {categoryTotals
            .filter((c) => c.totalCents > 0)
            .map((c) => (
              <div key={c.category.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                <span className="text-slate-700">{c.category.icon} {c.category.name}</span>
                <span className="font-medium text-slate-900">{formatCurrency(c.totalCents)}</span>
              </div>
            ))}
          {categoryTotals.every((c) => c.totalCents === 0) && (
            <p className="py-6 text-center text-sm text-slate-400">No spending in this month yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "owe" | "owed" }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "owe" ? "text-owe" : tone === "owed" ? "text-owed" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
