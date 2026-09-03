import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAppUser, getPayments } from "@/lib/data/queries";
import { PaymentRow } from "@/components/PaymentRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export default async function PaymentsPage() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const payments = await getPayments();

  const groups = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = groups.get(p.date) ?? [];
    list.push(p);
    groups.set(p.date, list);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
        <Link href="/payments/new">
          <Button>Record Payment</Button>
        </Link>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon="💸"
          title="No payments recorded yet"
          description="When one of you settles up, record it here to update the balance."
        />
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([date, dayPayments]) => (
            <div key={date}>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {formatDate(date)}
              </p>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
                {dayPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} currentUser={currentUser} showDelete />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
