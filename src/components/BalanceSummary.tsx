import { formatCurrency } from "@/lib/utils";
import type { BalanceResult } from "@/types";
import { Card } from "./ui/Card";

export function BalanceSummary({
  balance,
  friendName,
}: {
  balance: BalanceResult;
  friendName: string;
}) {
  const isSettled = balance.net === 0;
  const friendOwesYou = balance.net > 0;

  return (
    <Card className="animate-slide-up">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">You owe</p>
          <p className="mt-1 text-2xl font-semibold text-owe">
            {formatCurrency(balance.iOweFriend)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {friendName} owes you
          </p>
          <p className="mt-1 text-2xl font-semibold text-owed">
            {formatCurrency(balance.friendOwesMe)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Net balance</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              isSettled ? "text-slate-500" : friendOwesYou ? "text-owed" : "text-owe"
            }`}
          >
            {balance.net > 0 ? "+" : balance.net < 0 ? "-" : ""}
            {formatCurrency(Math.abs(balance.net))}
          </p>
        </div>
      </div>

      <div
        className={`mt-5 rounded-xl px-4 py-3 text-sm font-medium ${
          isSettled
            ? "bg-slate-100 text-slate-600"
            : friendOwesYou
            ? "bg-owed-light text-owed-dark"
            : "bg-owe-light text-owe-dark"
        }`}
      >
        {isSettled
          ? "You're all settled up! 🎉"
          : friendOwesYou
          ? `${friendName} owes you ${formatCurrency(balance.net)}`
          : `You owe ${friendName} ${formatCurrency(-balance.net)}`}
      </div>
    </Card>
  );
}
