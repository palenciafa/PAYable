import type {
  BalanceHistoryPoint,
  BalanceResult,
  Category,
  CategoryTotal,
  MonthlySummary,
  Payment,
  TransactionWithDetails,
} from "@/types";

/**
 * THE balance calculation. Every screen (dashboard, transaction detail,
 * monthly summary, Excel export) must go through this function (or its
 * SQL-formula equivalent for Excel) rather than re-deriving debt itself.
 *
 * The balance is NEVER read from a stored "amount owed" column — it is
 * always recomputed from raw transactions + splits + payments, exactly
 * as specified: total, share, who paid, and settlements.
 */
export function calculateBalance(
  transactions: TransactionWithDetails[],
  payments: Payment[],
  currentUserId: string,
  otherUserId: string
): BalanceResult {
  let grossOwedToMe = 0; // other user's share of things I paid for
  let grossIOwe = 0; // my share of things the other user paid for

  for (const txn of transactions) {
    if (txn.paid_by === currentUserId) {
      const otherShare = txn.splits.find((s) => s.user_id === otherUserId);
      grossOwedToMe += otherShare?.amount_cents ?? 0;
    } else if (txn.paid_by === otherUserId) {
      const myShare = txn.splits.find((s) => s.user_id === currentUserId);
      grossIOwe += myShare?.amount_cents ?? 0;
    }
    // Transactions paid by neither of these two users are ignored here;
    // with exactly two users that never happens, but this keeps the
    // function safe if the ledger later grows to more people.
  }

  let paymentsToMe = 0; // other user paying me back
  let paymentsIMade = 0; // me paying the other user back

  for (const p of payments) {
    if (p.from_user === otherUserId && p.to_user === currentUserId) {
      paymentsToMe += p.amount_cents;
    } else if (p.from_user === currentUserId && p.to_user === otherUserId) {
      paymentsIMade += p.amount_cents;
    }
  }

  // Net = everything owed to me, minus everything I owe. Computing this
  // as one signed number first (rather than netting each side
  // independently) is what makes overpayment / round-trip settlements
  // resolve safely instead of producing two simultaneous positive debts.
  const net =
    grossOwedToMe - paymentsToMe - (grossIOwe - paymentsIMade);

  return {
    grossOwedToMe,
    grossIOwe,
    paymentsToMe,
    paymentsIMade,
    friendOwesMe: net > 0 ? net : 0,
    iOweFriend: net < 0 ? -net : 0,
    net,
  };
}

/**
 * Cumulative net balance over time, for the balance-history chart.
 * Positive = friend owes currentUser at that point in time.
 */
export function calculateBalanceHistory(
  transactions: TransactionWithDetails[],
  payments: Payment[],
  currentUserId: string,
  otherUserId: string
): BalanceHistoryPoint[] {
  type Event = { date: string; delta: number };
  const events: Event[] = [];

  for (const txn of transactions) {
    if (txn.paid_by === currentUserId) {
      const otherShare = txn.splits.find((s) => s.user_id === otherUserId);
      if (otherShare) events.push({ date: txn.date, delta: otherShare.amount_cents });
    } else if (txn.paid_by === otherUserId) {
      const myShare = txn.splits.find((s) => s.user_id === currentUserId);
      if (myShare) events.push({ date: txn.date, delta: -myShare.amount_cents });
    }
  }

  for (const p of payments) {
    if (p.from_user === otherUserId && p.to_user === currentUserId) {
      events.push({ date: p.date, delta: -p.amount_cents });
    } else if (p.from_user === currentUserId && p.to_user === otherUserId) {
      events.push({ date: p.date, delta: p.amount_cents });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const points: BalanceHistoryPoint[] = [];
  for (const e of events) {
    running += e.delta;
    points.push({ date: e.date, netCents: running });
  }
  return points;
}

/**
 * Validate that a set of splits sums exactly to the transaction total.
 * Mirrors the database-level check_splits_sum_to_total() trigger so we
 * fail fast client-side, but the DB trigger remains the real guarantee.
 */
export function validateSplitsSumToTotal(
  splitAmountsCents: number[],
  totalCents: number
): { valid: boolean; difference: number } {
  const sum = splitAmountsCents.reduce((a, b) => a + b, 0);
  return { valid: sum === totalCents, difference: totalCents - sum };
}

/**
 * Given a total and a 50/50 split, computes each share in cents,
 * handling odd centavos deterministically (first user gets the extra
 * centavo if the total is not evenly divisible by 2).
 */
export function splitEvenly(
  totalCents: number,
  userIds: [string, string]
): Record<string, number> {
  const base = Math.floor(totalCents / 2);
  const remainder = totalCents - base * 2;
  return {
    [userIds[0]]: base + remainder,
    [userIds[1]]: base,
  };
}

/**
 * Build a monthly summary (yyyy-mm) for one specific month from the full
 * set of transactions and payments. Filtering to the month happens here
 * so the caller can just pass everything it has.
 */
export function calculateMonthlySummary(
  transactions: TransactionWithDetails[],
  payments: Payment[],
  currentUserId: string,
  otherUserId: string,
  month: string // yyyy-mm
): MonthlySummary {
  const monthTxns = transactions.filter((t) => t.date.startsWith(month));
  const monthPayments = payments.filter((p) => p.date.startsWith(month));

  let totalExpensesCents = 0;
  let paidByMeCents = 0;
  let paidByFriendCents = 0;

  for (const t of monthTxns) {
    totalExpensesCents += t.total_amount_cents;
    if (t.paid_by === currentUserId) paidByMeCents += t.total_amount_cents;
    else if (t.paid_by === otherUserId) paidByFriendCents += t.total_amount_cents;
  }

  const balance = calculateBalance(monthTxns, monthPayments, currentUserId, otherUserId);
  const paymentsCents = balance.paymentsToMe + balance.paymentsIMade;

  return {
    month,
    totalExpensesCents,
    paidByMeCents,
    paidByFriendCents,
    friendOwesMeCents: balance.grossOwedToMe,
    iOweFriendCents: balance.grossIOwe,
    paymentsCents,
    netCents: balance.net,
  };
}

/** Total spend per category across a given set of transactions. */
export function calculateCategoryTotals(
  transactions: TransactionWithDetails[],
  categories: Category[]
): CategoryTotal[] {
  const sums = new Map<string, number>();
  for (const t of transactions) {
    sums.set(t.category_id, (sums.get(t.category_id) ?? 0) + t.total_amount_cents);
  }
  return categories
    .map((category) => ({ category, totalCents: sums.get(category.id) ?? 0 }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Compute cent amounts from percentages, guaranteeing the sum equals totalCents. */
export function splitByPercentage(
  totalCents: number,
  percentages: Record<string, number>
): Record<string, number> {
  const entries = Object.entries(percentages);
  const raw = entries.map(([id, pct]) => [id, (totalCents * pct) / 100] as const);
  const floored = raw.map(([id, v]) => [id, Math.floor(v)] as const);
  let allocated = floored.reduce((sum, [, v]) => sum + v, 0);
  let remainder = totalCents - allocated;

  // Distribute leftover centavos to the entries with the largest
  // fractional remainder first (largest-remainder method), so the
  // split always sums exactly to totalCents.
  const withFraction = raw.map(([id, v], i) => ({
    id,
    fraction: v - (floored[i]?.[1] ?? 0),
  }));
  withFraction.sort((a, b) => b.fraction - a.fraction);

  const result: Record<string, number> = {};
  for (const [id, v] of floored) result[id] = v;
  for (let i = 0; i < withFraction.length && remainder > 0; i++) {
    const entry = withFraction[i];
    if (!entry) continue;
    result[entry.id] = (result[entry.id] ?? 0) + 1;
    remainder--;
  }
  return result;
}
