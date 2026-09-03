import { redirect } from "next/navigation";
import { getAllUsers, getCurrentAppUser, getRawPayments, getTransactions } from "@/lib/data/queries";
import { calculateBalance } from "@/lib/balance";
import { PaymentForm } from "@/components/PaymentForm";
import { Card } from "@/components/ui/Card";

export default async function NewPaymentPage() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);
  if (!otherUser) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Add a second user before recording payments.</p>
      </Card>
    );
  }

  const [transactions, payments] = await Promise.all([getTransactions(), getRawPayments()]);
  const balance = calculateBalance(transactions, payments, currentUser.id, otherUser.id);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Record Payment</h1>
      <PaymentForm currentUser={currentUser} otherUser={otherUser} balance={balance} />
    </div>
  );
}
