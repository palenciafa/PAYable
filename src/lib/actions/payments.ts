"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentInputSchema, type PaymentInput } from "@/lib/validation";
import { pesosToCents } from "@/lib/utils";
import type { ActionResult } from "./transactions";

export async function createPayment(raw: PaymentInput): Promise<ActionResult> {
  const parsed = paymentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("payments").insert({
    from_user: input.fromUser,
    to_user: input.toUser,
    amount_cents: pesosToCents(input.amount),
    payment_method: input.paymentMethod,
    date: input.date,
    notes: input.notes || null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/payments");
  revalidatePath("/analytics");
  return { success: true };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/payments");
  revalidatePath("/analytics");
  return { success: true };
}
