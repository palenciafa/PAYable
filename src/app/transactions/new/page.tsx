import { getAllUsers, getCategories, getCurrentAppUser } from "@/lib/data/queries";
import { TransactionForm } from "@/components/TransactionForm";
import { redirect } from "next/navigation";

export default async function NewTransactionPage() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const [users, categories] = await Promise.all([getAllUsers(), getCategories()]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Add Transaction</h1>
      <TransactionForm users={users} categories={categories} currentUser={currentUser} />
    </div>
  );
}
