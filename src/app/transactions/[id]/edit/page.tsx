import { notFound, redirect } from "next/navigation";
import { getAllUsers, getCategories, getCurrentAppUser, getTransactionById } from "@/lib/data/queries";
import { TransactionForm } from "@/components/TransactionForm";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const [transaction, users, categories] = await Promise.all([
    getTransactionById(id),
    getAllUsers(),
    getCategories(),
  ]);
  if (!transaction) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Edit Transaction</h1>
      <TransactionForm users={users} categories={categories} currentUser={currentUser} existing={transaction} />
    </div>
  );
}
