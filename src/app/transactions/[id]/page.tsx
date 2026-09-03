import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAllUsers, getCurrentAppUser, getTransactionById } from "@/lib/data/queries";
import { deleteTransaction } from "@/lib/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/DeleteButton";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const transaction = await getTransactionById(id);
  if (!transaction) notFound();

  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);
  if (!otherUser) notFound();

  const iPaid = transaction.paid_by === currentUser.id;
  const myShare = transaction.splits.find((s) => s.user_id === currentUser.id)?.amount_cents ?? 0;
  const otherShare = transaction.splits.find((s) => s.user_id === otherUser.id)?.amount_cents ?? 0;

  const resultLabel = iPaid
    ? `${otherUser.name} owes you ${formatCurrency(otherShare)}`
    : `You owe ${otherUser.name} ${formatCurrency(myShare)}`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/transactions" className="text-sm text-brand-600 hover:underline">
        ← Back to transactions
      </Link>

      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-3xl">{transaction.category.icon}</span>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">{transaction.description}</h1>
            <p className="text-sm text-slate-500">{formatDate(transaction.date)}</p>
          </div>
          <span className="badge bg-slate-100 text-slate-600">{transaction.category.name}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(transaction.total_amount_cents)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paid by</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {iPaid ? "You" : otherUser.name}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Split</p>
          <div className="space-y-2">
            <div className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
              <span className="text-slate-600">You</span>
              <span className="font-medium text-slate-900">{formatCurrency(myShare)}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
              <span className="text-slate-600">{otherUser.name}</span>
              <span className="font-medium text-slate-900">{formatCurrency(otherShare)}</span>
            </div>
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${iPaid ? "bg-owed-light text-owed-dark" : "bg-owe-light text-owe-dark"}`}>
          {resultLabel}
        </div>

        {transaction.notes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
            <p className="mt-1 text-sm text-slate-600">{transaction.notes}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/transactions/${transaction.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <DeleteButton
            action={async () => deleteTransaction(transaction.id)}
            confirmTitle="Delete this transaction?"
            confirmMessage="This will remove it from your history and recalculate the balance. This can't be undone."
            redirectTo="/transactions"
          />
        </div>
      </Card>
    </div>
  );
}
