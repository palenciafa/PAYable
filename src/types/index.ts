// All money in this file is represented in CENTS (integer pesos * 100)
// everywhere except at the UI edge, where we format/parse to decimal
// pesos. Never do balance math on floats.

export type PaymentMethod = "Cash" | "GCash" | "Bank Transfer" | "Other";

export type SplitMode = "50-50" | "custom" | "percentage";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  user_id: string;
  amount_cents: number;
  percentage: number | null;
}

export interface Transaction {
  id: string;
  description: string;
  category_id: string;
  total_amount_cents: number;
  paid_by: string;
  date: string; // ISO date, yyyy-mm-dd
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithDetails extends Transaction {
  category: Category;
  splits: TransactionSplit[];
  paid_by_user: AppUser;
}

export interface Payment {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface PaymentWithUsers extends Payment {
  from_user_data: AppUser;
  to_user_data: AppUser;
}

/** Result of the centralized balance calculation. All amounts in cents. */
export interface BalanceResult {
  /** How much `otherUser` owes `currentUser`, from expenses, before payments. */
  grossOwedToMe: number;
  /** How much `currentUser` owes `otherUser`, from expenses, before payments. */
  grossIOwe: number;
  /** Payments `otherUser` has made to `currentUser`. */
  paymentsToMe: number;
  /** Payments `currentUser` has made to `otherUser`. */
  paymentsIMade: number;
  /** Net amount otherUser owes currentUser after payments (can be negative). */
  friendOwesMe: number;
  /** Net amount currentUser owes otherUser after payments (can be negative). */
  iOweFriend: number;
  /** friendOwesMe - iOweFriend. Positive = friend owes you. Negative = you owe friend. */
  net: number;
}

/** One point on the balance-over-time chart. */
export interface BalanceHistoryPoint {
  date: string;
  netCents: number;
}

/** Combined feed item for the activity timeline. */
export type ActivityItem =
  | { kind: "transaction"; date: string; data: TransactionWithDetails }
  | { kind: "payment"; date: string; data: PaymentWithUsers };

export interface MonthlySummary {
  month: string; // yyyy-mm
  totalExpensesCents: number;
  paidByMeCents: number;
  paidByFriendCents: number;
  friendOwesMeCents: number;
  iOweFriendCents: number;
  paymentsCents: number;
  netCents: number;
}

export interface CategoryTotal {
  category: Category;
  totalCents: number;
}
