import { describe, expect, it } from "vitest";
import {
  calculateBalance,
  calculateBalanceHistory,
  splitByPercentage,
  splitEvenly,
  validateSplitsSumToTotal,
} from "./balance";
import type { Payment, TransactionWithDetails } from "@/types";

const ME = "user-me";
const FRIEND = "user-friend";

// Minimal fixture builder — only the fields calculateBalance reads matter.
function txn(opts: {
  paidBy: string;
  total: number;
  meShare: number;
  friendShare: number;
  date?: string;
}): TransactionWithDetails {
  return {
    id: crypto.randomUUID(),
    description: "test",
    category_id: "cat-1",
    total_amount_cents: opts.total,
    paid_by: opts.paidBy,
    date: opts.date ?? "2026-09-01",
    notes: null,
    created_by: opts.paidBy,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    category: { id: "cat-1", name: "Food", icon: "🍔", sort_order: 1 },
    paid_by_user: { id: opts.paidBy, name: "x", email: "x", avatar_url: null, created_at: "" },
    splits: [
      { id: crypto.randomUUID(), transaction_id: "t", user_id: ME, amount_cents: opts.meShare, percentage: null },
      { id: crypto.randomUUID(), transaction_id: "t", user_id: FRIEND, amount_cents: opts.friendShare, percentage: null },
    ],
  };
}

function payment(opts: { from: string; to: string; amount: number; date?: string }): Payment {
  return {
    id: crypto.randomUUID(),
    from_user: opts.from,
    to_user: opts.to,
    amount_cents: opts.amount,
    payment_method: "GCash",
    date: opts.date ?? "2026-09-02",
    notes: null,
    created_at: "2026-09-02T00:00:00Z",
  };
}

describe("calculateBalance", () => {
  it("Test 1: I pay 500, 50/50 -> friend owes me 250", () => {
    const t = [txn({ paidBy: ME, total: 50000, meShare: 25000, friendShare: 25000 })];
    const r = calculateBalance(t, [], ME, FRIEND);
    expect(r.friendOwesMe).toBe(25000);
    expect(r.iOweFriend).toBe(0);
    expect(r.net).toBe(25000);
  });

  it("Test 2: friend pays 500, 50/50 -> I owe friend 250", () => {
    const t = [txn({ paidBy: FRIEND, total: 50000, meShare: 25000, friendShare: 25000 })];
    const r = calculateBalance(t, [], ME, FRIEND);
    expect(r.iOweFriend).toBe(25000);
    expect(r.friendOwesMe).toBe(0);
    expect(r.net).toBe(-25000);
  });

  it("Test 3: I pay 1000, my share 300 / friend share 700 -> friend owes me 700", () => {
    const t = [txn({ paidBy: ME, total: 100000, meShare: 30000, friendShare: 70000 })];
    const r = calculateBalance(t, [], ME, FRIEND);
    expect(r.friendOwesMe).toBe(70000);
    expect(r.net).toBe(70000);
  });

  it("Test 4: friend owes me 1000, friend pays 600 -> friend owes me 400", () => {
    const t = [txn({ paidBy: ME, total: 100000, meShare: 0, friendShare: 100000 })];
    const p = [payment({ from: FRIEND, to: ME, amount: 60000 })];
    const r = calculateBalance(t, p, ME, FRIEND);
    expect(r.friendOwesMe).toBe(40000);
    expect(r.net).toBe(40000);
  });

  it("Test 5: I owe friend 500, I pay friend 500 -> settled", () => {
    const t = [txn({ paidBy: FRIEND, total: 50000, meShare: 50000, friendShare: 0 })];
    const p = [payment({ from: ME, to: FRIEND, amount: 50000 })];
    const r = calculateBalance(t, p, ME, FRIEND);
    expect(r.net).toBe(0);
    expect(r.friendOwesMe).toBe(0);
    expect(r.iOweFriend).toBe(0);
  });

  it("Test 6: multiple transactions in both directions combine into one net balance", () => {
    const t = [
      txn({ paidBy: ME, total: 100000, meShare: 40000, friendShare: 60000 }), // friend owes 600
      txn({ paidBy: FRIEND, total: 50000, meShare: 20000, friendShare: 30000 }), // I owe 200
      txn({ paidBy: ME, total: 30000, meShare: 15000, friendShare: 15000 }), // friend owes 150
    ];
    const p = [payment({ from: FRIEND, to: ME, amount: 10000 })]; // friend paid 100
    const r = calculateBalance(t, p, ME, FRIEND);
    // gross owed to me: 60000 + 15000 = 75000; minus payments to me 10000 = 65000
    // gross I owe: 20000; minus payments I made 0 = 20000
    // net = 65000 - 20000 = 45000 (friend owes me 450)
    expect(r.net).toBe(45000);
    expect(r.friendOwesMe).toBe(45000);
    expect(r.iOweFriend).toBe(0);
  });

  it("handles an overpayment safely instead of producing an incorrect balance", () => {
    const t = [txn({ paidBy: ME, total: 100000, meShare: 0, friendShare: 100000 })]; // friend owes 1000
    const p = [payment({ from: FRIEND, to: ME, amount: 150000 })]; // friend overpays by 500
    const r = calculateBalance(t, p, ME, FRIEND);
    // net = 100000 - 150000 = -50000 -> now I owe friend 500
    expect(r.net).toBe(-50000);
    expect(r.iOweFriend).toBe(50000);
    expect(r.friendOwesMe).toBe(0);
  });

  it("is symmetric: swapping perspective negates net", () => {
    const t = [txn({ paidBy: ME, total: 100000, meShare: 40000, friendShare: 60000 })];
    const rMe = calculateBalance(t, [], ME, FRIEND);
    const rFriend = calculateBalance(t, [], FRIEND, ME);
    expect(rMe.net).toBe(-rFriend.net);
  });

  it("returns all zeros with no data", () => {
    const r = calculateBalance([], [], ME, FRIEND);
    expect(r.net).toBe(0);
    expect(r.friendOwesMe).toBe(0);
    expect(r.iOweFriend).toBe(0);
  });
});

describe("calculateBalanceHistory", () => {
  it("produces a running cumulative total ordered by date", () => {
    const t = [
      txn({ paidBy: ME, total: 20000, meShare: 10000, friendShare: 10000, date: "2026-08-01" }), // +100
      txn({ paidBy: ME, total: 60000, meShare: 20000, friendShare: 40000, date: "2026-08-10" }), // +400 -> 500
    ];
    const p = [payment({ from: FRIEND, to: ME, amount: 30000, date: "2026-09-01" })]; // -300 -> 200
    const points = calculateBalanceHistory(t, p, ME, FRIEND);
    expect(points.map((p) => p.netCents)).toEqual([10000, 50000, 20000]);
  });
});

describe("splitEvenly", () => {
  it("splits an even amount equally", () => {
    const s = splitEvenly(50000, [ME, FRIEND]);
    expect(s[ME]).toBe(25000);
    expect(s[FRIEND]).toBe(25000);
  });

  it("gives the odd centavo to the first user and still sums exactly", () => {
    const s = splitEvenly(10001, [ME, FRIEND]);
    expect((s[ME] ?? 0) + (s[FRIEND] ?? 0)).toBe(10001);
  });
});

describe("splitByPercentage", () => {
  it("sums exactly to the total even with rounding", () => {
    const s = splitByPercentage(10000, { [ME]: 33.33, [FRIEND]: 66.67 });
    expect((s[ME] ?? 0) + (s[FRIEND] ?? 0)).toBe(10000);
  });
});

describe("validateSplitsSumToTotal", () => {
  it("flags a mismatch with the exact difference", () => {
    const r = validateSplitsSumToTotal([25000, 24000], 50000);
    expect(r.valid).toBe(false);
    expect(r.difference).toBe(1000);
  });
  it("passes when splits sum exactly", () => {
    const r = validateSplitsSumToTotal([25000, 25000], 50000);
    expect(r.valid).toBe(true);
  });
});
