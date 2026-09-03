import Link from "next/link";
import {
  getActivityFeed,
  getAllUsers,
  getCategories,
  getCurrentAppUser,
  getRawPayments,
  getTransactions,
} from "@/lib/data/queries";
import {
  calculateBalance,
  calculateBalanceHistory,
  calculateCategoryTotals,
  calculateMonthlySummary,
} from "@/lib/balance";
import { formatCurrency, todayISO } from "@/lib/utils";
import { BalanceSummary } from "@/components/BalanceSummary";
import { ActivityList } from "@/components/ActivityList";
import { CategoryChart } from "@/components/CategoryChart";
import { BalanceChart } from "@/components/BalanceChart";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function DashboardPage() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          You&rsquo;re signed in, but this account isn&rsquo;t set up as a PAYable user yet. Ask
          whoever set up the app to add your account &mdash; see the README&rsquo;s
          &ldquo;Seed the two users&rdquo; step.
        </p>
      </Card>
    );
  }

  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);

  if (!otherUser) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          PAYable needs a second person set up to track a balance against. Add your friend&rsquo;s
          account &mdash; see the README&rsquo;s &ldquo;Seed the two users&rdquo; step.
        </p>
      </Card>
    );
  }

  const [transactions, payments, categories, activity] = await Promise.all([
    getTransactions(),
    getRawPayments(),
    getCategories(),
    getActivityFeed(8),
  ]);

  const balance = calculateBalance(transactions, payments, currentUser.id, otherUser.id);
  const history = calculateBalanceHistory(transactions, payments, currentUser.id, otherUser.id);
  const thisMonth = todayISO().slice(0, 7);
  const monthTxns = transactions.filter((t) => t.date.startsWith(thisMonth));
  const monthly = calculateMonthlySummary(transactions, payments, currentUser.id, otherUser.id, thisMonth);
  const categoryTotals = calculateCategoryTotals(monthTxns, categories);

  const totalSharedExpenses = transactions.reduce((sum, t) => sum + t.total_amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Hey, {currentUser.name.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">Here&rsquo;s where things stand with {otherUser.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/transactions/new">
            <Button variant="primary">+ Add Transaction</Button>
          </Link>
          <Link href="/payments/new">
            <Button variant="secondary">Record Payment</Button>
          </Link>
          <a href="/api/export">
            <Button variant="secondary">Export to Excel</Button>
          </a>
        </div>
      </div>

      <BalanceSummary balance={balance} friendName={otherUser.name} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400">Total shared expenses</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatCurrency(totalSharedExpenses)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400">Spending this month</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatCurrency(monthly.totalExpensesCents)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400">You paid this month</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatCurrency(monthly.paidByMeCents)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400">{otherUser.name} paid this month</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatCurrency(monthly.paidByFriendCents)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Balance over time</h2>
            <Link href="/analytics" className="text-sm text-brand-600 hover:underline">
              View analytics
            </Link>
          </div>
          <BalanceChart points={history} friendName={otherUser.name} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">Spending by category (this month)</h2>
          <CategoryChart totals={categoryTotals} />
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-semibold text-slate-900">Recent activity</h2>
          <Link href="/transactions" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        <ActivityList items={activity} currentUser={currentUser} otherUser={otherUser} />
      </div>
    </div>
  );
}
