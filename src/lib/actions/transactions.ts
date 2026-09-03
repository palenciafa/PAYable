"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionInputSchema, type TransactionInput } from "@/lib/validation";
import { pesosToCents } from "@/lib/utils";
import { splitByPercentage, splitEvenly, validateSplitsSumToTotal } from "@/lib/balance";
import { getAllUsers } from "@/lib/data/queries";

export type ActionResult = { success: true } | { success: false; error: string };

/** Turns validated input + split mode into a final { userId: cents } map that is
 *  guaranteed (by construction, then re-checked) to sum exactly to the total. */
function resolveSplitCents(input: TransactionInput, userIds: [string, string]): Record<string, number> {
  const totalCents = pesosToCents(input.totalAmount);

  if (input.splitMode === "50-50") {
    return splitEvenly(totalCents, userIds);
  }

  if (input.splitMode === "percentage") {
    const pcts: Record<string, number> = {};
    for (const id of userIds) pcts[id] = input.splits?.[id] ?? 0;
    return splitByPercentage(totalCents, pcts);
  }

  // custom: amounts already given in pesos, convert to cents directly
  const cents: Record<string, number> = {};
  for (const id of userIds) cents[id] = pesosToCents(input.splits?.[id] ?? 0);
  return cents;
}

export async function createTransaction(raw: TransactionInput): Promise<ActionResult> {
  const parsed = transactionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const users = await getAllUsers();
  if (users.length !== 2) {
    return { success: false, error: "This app expects exactly two users to be set up." };
  }
  const userIds = users.map((u) => u.id) as [string, string];
  const totalCents = pesosToCents(input.totalAmount);
  const splitCents = resolveSplitCents(input, userIds);

  const check = validateSplitsSumToTotal(Object.values(splitCents), totalCents);
  if (!check.valid) {
    return {
      success: false,
      error: `Split amounts don't add up to the total (off by ${(check.difference / 100).toFixed(2)}).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      description: input.description,
      category_id: input.categoryId,
      total_amount_cents: totalCents,
      paid_by: input.paidBy,
      date: input.date,
      notes: input.notes || null,
      created_by: authUser?.id ?? null,
    })
    .select()
    .single();

  if (txnError || !txn) {
    return { success: false, error: txnError?.message ?? "Failed to create transaction" };
  }

  const splitRows = userIds.map((id) => ({
    transaction_id: txn.id,
    user_id: id,
    amount_cents: splitCents[id] ?? 0,
    percentage: totalCents > 0 ? Number((((splitCents[id] ?? 0) / totalCents) * 100).toFixed(3)) : 0,
  }));

  const { error: splitsError } = await supabase.from("transaction_splits").insert(splitRows);
  if (splitsError) {
    // Roll back the orphaned transaction so we never leave a txn without splits.
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { success: false, error: splitsError.message };
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
  return { success: true };
}

export async function updateTransaction(id: string, raw: TransactionInput): Promise<ActionResult> {
  const parsed = transactionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const users = await getAllUsers();
  const userIds = users.map((u) => u.id) as [string, string];
  const totalCents = pesosToCents(input.totalAmount);
  const splitCents = resolveSplitCents(input, userIds);

  const check = validateSplitsSumToTotal(Object.values(splitCents), totalCents);
  if (!check.valid) {
    return {
      success: false,
      error: `Split amounts don't add up to the total (off by ${(check.difference / 100).toFixed(2)}).`,
    };
  }

  const supabase = await createClient();

  const { error: txnError } = await supabase
    .from("transactions")
    .update({
      description: input.description,
      category_id: input.categoryId,
      total_amount_cents: totalCents,
      paid_by: input.paidBy,
      date: input.date,
      notes: input.notes || null,
    })
    .eq("id", id);

  if (txnError) return { success: false, error: txnError.message };

  // Replace splits atomically-ish: delete then insert. The DB trigger
  // that checks splits sum to total is deferred to end-of-transaction
  // in Postgres, but supabase-js issues these as separate statements,
  // so we validate client-side above and re-check here defensively.
  const { error: deleteError } = await supabase.from("transaction_splits").delete().eq("transaction_id", id);
  if (deleteError) return { success: false, error: deleteError.message };

  const splitRows = userIds.map((uid) => ({
    transaction_id: id,
    user_id: uid,
    amount_cents: splitCents[uid] ?? 0,
    percentage: totalCents > 0 ? Number((((splitCents[uid] ?? 0) / totalCents) * 100).toFixed(3)) : 0,
  }));
  const { error: insertError } = await supabase.from("transaction_splits").insert(splitRows);
  if (insertError) return { success: false, error: insertError.message };

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${id}`);
  revalidatePath("/analytics");
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
  return { success: true };
}
