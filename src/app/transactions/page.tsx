import { redirect } from "next/navigation";
import {
  getAllUsers,
  getCategories,
  getCurrentAppUser,
  getTransactions,
} from "@/lib/data/queries";
import { TransactionFilters } from "@/components/TransactionFilters";
import { TransactionRow } from "@/components/TransactionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayISO } from "@/lib/utils";

function rangeToDates(range: string | undefined): { from?: string; to?: string } {
  if (!range) return {};
  const today = new Date();
  const to = todayISO();
  if (range === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return { from: d.toISOString().slice(0, 10), to };
  }
  if (range === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return { from: d.toISOString().slice(0, 10), to };
  }
  if (range === "month") {
    return { from: `${today.toISOString().slice(0, 7)}-01`, to };
  }
  return {};
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; paidBy?: string; range?: string }>;
}) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const params = await searchParams;
  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);
  const categories = await getCategories();

  const { from, to } = rangeToDates(params.range);
  const transactions = await getTransactions({
    categoryId: params.category || undefined,
    paidBy: params.paidBy || undefined,
    search: params.q || undefined,
    from,
    to,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
      </div>

      <TransactionFilters categories={categories} users={users} currentUser={currentUser} />

      {transactions.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No transactions found"
          description="Try adjusting your filters, or add a new transaction."
        />
      ) : otherUser ? (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          {transactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} currentUser={currentUser} otherUser={otherUser} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
