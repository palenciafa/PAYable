import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { AppUser, TransactionWithDetails } from "@/types";

export function TransactionRow({
  transaction,
  currentUser,
  otherUser,
}: {
  transaction: TransactionWithDetails;
  currentUser: AppUser;
  otherUser: AppUser;
}) {
  const iPaid = transaction.paid_by === currentUser.id;
  const otherShare = transaction.splits.find((s) => s.user_id === otherUser.id)?.amount_cents ?? 0;
  const myShare = transaction.splits.find((s) => s.user_id === currentUser.id)?.amount_cents ?? 0;

  const resultLabel = iPaid
    ? `${otherUser.name} owes you ${formatCurrency(otherShare)}`
    : `You owe ${otherUser.name} ${formatCurrency(myShare)}`;

  return (
    <Link
      href={`/transactions/${transaction.id}`}
      className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
        {transaction.category.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{transaction.description}</p>
        <p className="text-xs text-slate-500">
          {iPaid ? "You" : otherUser.name} paid {formatCurrency(transaction.total_amount_cents)}
        </p>
      </div>
      <p className={`shrink-0 text-right text-sm font-medium ${iPaid ? "text-owed" : "text-owe"}`}>
        {resultLabel}
      </p>
    </Link>
  );
}
