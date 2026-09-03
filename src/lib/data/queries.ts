import { createClient } from "@/lib/supabase/server";
import type {
  ActivityItem,
  AppUser,
  Category,
  Payment,
  PaymentWithUsers,
  TransactionWithDetails,
} from "@/types";

const TRANSACTION_SELECT = `
  *,
  category:categories(*),
  splits:transaction_splits(*),
  paid_by_user:users!transactions_paid_by_fkey(*)
`;

const PAYMENT_SELECT = `
  *,
  from_user_data:users!payments_from_user_fkey(*),
  to_user_data:users!payments_to_user_fkey(*)
`;

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  return data as AppUser | null;
}

export async function getAllUsers(): Promise<AppUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("created_at");
  if (error) throw error;
  return data as AppUser[];
}

/** In this two-person app, the "other" user relative to whoever is signed in. */
export async function getOtherUser(currentUserId: string): Promise<AppUser | null> {
  const users = await getAllUsers();
  return users.find((u) => u.id !== currentUserId) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return data as Category[];
}

export async function getTransactions(options?: {
  categoryId?: string;
  paidBy?: string;
  from?: string;
  to?: string;
  search?: string;
}): Promise<TransactionWithDetails[]> {
  const supabase = await createClient();
  let query = supabase.from("transactions").select(TRANSACTION_SELECT).order("date", { ascending: false }).order("created_at", { ascending: false });

  if (options?.categoryId) query = query.eq("category_id", options.categoryId);
  if (options?.paidBy) query = query.eq("paid_by", options.paidBy);
  if (options?.from) query = query.gte("date", options.from);
  if (options?.to) query = query.lte("date", options.to);
  if (options?.search) query = query.ilike("description", `%${options.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as TransactionWithDetails[];
}

export async function getTransactionById(id: string): Promise<TransactionWithDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as TransactionWithDetails;
}

export async function getPayments(): Promise<PaymentWithUsers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as PaymentWithUsers[];
}

export async function getRawPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*");
  if (error) throw error;
  return data as Payment[];
}

export async function getActivityFeed(limit?: number): Promise<ActivityItem[]> {
  const [transactions, payments] = await Promise.all([getTransactions(), getPayments()]);

  const items: ActivityItem[] = [
    ...transactions.map((t): ActivityItem => ({ kind: "transaction", date: t.date, data: t })),
    ...payments.map((p): ActivityItem => ({ kind: "payment", date: p.date, data: p })),
  ];

  items.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aCreated = a.kind === "transaction" ? a.data.created_at : a.data.created_at;
    const bCreated = b.kind === "transaction" ? b.data.created_at : b.data.created_at;
    return bCreated.localeCompare(aCreated);
  });

  return limit ? items.slice(0, limit) : items;
}
