"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, BalanceResult, PaymentMethod } from "@/types";
import { formatCurrency, todayISO } from "@/lib/utils";
import { createPayment } from "@/lib/actions/payments";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const METHODS: PaymentMethod[] = ["Cash", "GCash", "Bank Transfer", "Other"];

export function PaymentForm({
  currentUser,
  otherUser,
  balance,
}: {
  currentUser: AppUser;
  otherUser: AppUser;
  balance: BalanceResult;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const friendOwesYou = balance.net > 0;
  const [direction, setDirection] = useState<"toMe" | "fromMe">(friendOwesYou ? "toMe" : "fromMe");
  const [amount, setAmount] = useState(
    balance.net !== 0 ? String(Math.abs(balance.net) / 100) : ""
  );
  const [method, setMethod] = useState<PaymentMethod>("GCash");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  const currentDebt = direction === "toMe" ? balance.friendOwesMe : balance.iOweFriend;
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const exceedsDebt = currentDebt > 0 && amountCents > currentDebt;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fromUser = direction === "toMe" ? otherUser.id : currentUser.id;
    const toUser = direction === "toMe" ? currentUser.id : otherUser.id;

    startTransition(async () => {
      const result = await createPayment({
        fromUser,
        toUser,
        amount: parseFloat(amount || "0"),
        paymentMethod: method,
        date,
        notes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/payments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="space-y-4">
        <div>
          <p className="label mb-2">Who&rsquo;s paying?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("toMe")}
              className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                direction === "toMe" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {otherUser.name} → You
            </button>
            <button
              type="button"
              onClick={() => setDirection("fromMe")}
              className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                direction === "fromMe" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              You → {otherUser.name}
            </button>
          </div>
          {currentDebt > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Current debt in this direction: {formatCurrency(currentDebt)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount">Amount (₱)</label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {exceedsDebt && (
              <p className="mt-1.5 text-xs text-owe">
                This is more than the current debt ({formatCurrency(currentDebt)}). That&rsquo;s okay —
                the extra will flip the balance the other way.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="method">Method</label>
            <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="date">Date</label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </Card>

      <Card>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          className="input min-h-20 resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Partial settlement"
        />
      </Card>

      {error && <p className="text-sm text-owe">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || amountCents <= 0}>
          {isPending ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
