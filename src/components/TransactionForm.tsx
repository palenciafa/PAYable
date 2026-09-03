"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, Category, SplitMode, TransactionWithDetails } from "@/types";
import { centsToPesos, formatCurrency, pesosToCents, todayISO } from "@/lib/utils";
import { splitByPercentage, splitEvenly } from "@/lib/balance";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export function TransactionForm({
  users,
  categories,
  currentUser,
  existing,
}: {
  users: AppUser[];
  categories: Category[];
  currentUser: AppUser;
  existing?: TransactionWithDetails;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const otherUser = users.find((u) => u.id !== currentUser.id) ?? users[1] ?? users[0];
  const userIds = useMemo<[string, string]>(
    () => [currentUser.id, otherUser?.id ?? currentUser.id],
    [currentUser.id, otherUser]
  );

  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? categories[0]?.id ?? "");
  const [totalAmount, setTotalAmount] = useState(
    existing ? String(centsToPesos(existing.total_amount_cents)) : ""
  );
  const [paidBy, setPaidBy] = useState(existing?.paid_by ?? currentUser.id);
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const initialMode: SplitMode = existing
    ? existing.splits.every((s) => s.percentage !== null && Math.abs(s.percentage - 50) < 0.01)
      ? "50-50"
      : "custom"
    : "50-50";
  const [splitMode, setSplitMode] = useState<SplitMode>(initialMode);

  const existingCustom = existing
    ? Object.fromEntries(existing.splits.map((s) => [s.user_id, String(centsToPesos(s.amount_cents))]))
    : {};
  const existingPct = existing
    ? Object.fromEntries(existing.splits.map((s) => [s.user_id, String(s.percentage ?? 0)]))
    : {};

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({
    [userIds[0]]: existingCustom[userIds[0]] ?? "",
    [userIds[1]]: existingCustom[userIds[1]] ?? "",
  });
  const [percentages, setPercentages] = useState<Record<string, string>>({
    [userIds[0]]: existingPct[userIds[0]] ?? "50",
    [userIds[1]]: existingPct[userIds[1]] ?? "50",
  });

  const totalCents = pesosToCents(totalAmount || "0");

  const preview = useMemo(() => {
    if (splitMode === "50-50") return splitEvenly(totalCents, userIds);
    if (splitMode === "percentage") {
      return splitByPercentage(totalCents, {
        [userIds[0]]: parseFloat(percentages[userIds[0]] || "0"),
        [userIds[1]]: parseFloat(percentages[userIds[1]] || "0"),
      });
    }
    return {
      [userIds[0]]: pesosToCents(customAmounts[userIds[0]] || "0"),
      [userIds[1]]: pesosToCents(customAmounts[userIds[1]] || "0"),
    };
  }, [splitMode, totalCents, userIds, percentages, customAmounts]);

  const previewSum = (preview[userIds[0]] ?? 0) + (preview[userIds[1]] ?? 0);
  const splitIsValid = splitMode === "50-50" || previewSum === totalCents;

  function userLabel(id: string) {
    return id === currentUser.id ? "You" : otherUser?.name ?? "Friend";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const splits: Record<string, number> =
      splitMode === "custom"
        ? { [userIds[0]]: parseFloat(customAmounts[userIds[0]] || "0"), [userIds[1]]: parseFloat(customAmounts[userIds[1]] || "0") }
        : splitMode === "percentage"
        ? { [userIds[0]]: parseFloat(percentages[userIds[0]] || "0"), [userIds[1]]: parseFloat(percentages[userIds[1]] || "0") }
        : {};

    const input = {
      description,
      categoryId,
      totalAmount: parseFloat(totalAmount || "0"),
      paidBy,
      date,
      notes: notes || null,
      splitMode,
      splits,
    };

    startTransition(async () => {
      const result = existing
        ? await updateTransaction(existing.id, input)
        : await createTransaction(input);

      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(existing ? `/transactions/${existing.id}` : "/transactions");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="space-y-4">
        <div>
          <label className="label" htmlFor="description">Description</label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="McDonald's Dinner"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="total">Total amount (₱)</label>
            <Input
              id="total"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="500.00"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="paidBy">Paid by</label>
            <Select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {userIds.map((id) => (
                <option key={id} value={id}>
                  {userLabel(id)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="date">Date</label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="label mb-2">Split</p>
          <div className="flex gap-2">
            {(["50-50", "custom", "percentage"] as SplitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  splitMode === mode
                    ? "bg-brand-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {mode === "50-50" ? "50 / 50" : mode === "custom" ? "Custom amount" : "Percentage"}
              </button>
            ))}
          </div>
        </div>

        {splitMode === "custom" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {userIds.map((id) => (
              <div key={id}>
                <label className="label">{userLabel(id)}&rsquo;s share (₱)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customAmounts[id] ?? ""}
                  onChange={(e) => setCustomAmounts((s) => ({ ...s, [id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {splitMode === "percentage" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {userIds.map((id) => (
              <div key={id}>
                <label className="label">{userLabel(id)}&rsquo;s share (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percentages[id] ?? ""}
                  onChange={(e) => setPercentages((s) => ({ ...s, [id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>{userLabel(userIds[0])}&rsquo;s share</span>
            <span className="font-medium text-slate-900">{formatCurrency(preview[userIds[0]] ?? 0)}</span>
          </div>
          <div className="mt-1 flex justify-between text-slate-600">
            <span>{userLabel(userIds[1])}&rsquo;s share</span>
            <span className="font-medium text-slate-900">{formatCurrency(preview[userIds[1]] ?? 0)}</span>
          </div>
          {!splitIsValid && (
            <p className="mt-2 text-owe">
              Shares add up to {formatCurrency(previewSum)}, but the total is {formatCurrency(totalCents)}.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          className="input min-h-20 resize-y"
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dinner after school"
        />
      </Card>

      {error && <p className="text-sm text-owe">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !splitIsValid || totalCents <= 0}>
          {isPending ? "Saving…" : existing ? "Save changes" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
