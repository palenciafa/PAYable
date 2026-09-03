import type { ActivityItem, AppUser } from "@/types";
import { formatDate } from "@/lib/utils";
import { TransactionRow } from "./TransactionRow";
import { PaymentRow } from "./PaymentRow";
import { EmptyState } from "./ui/EmptyState";

export function ActivityList({
  items,
  currentUser,
  otherUser,
}: {
  items: ActivityItem[];
  currentUser: AppUser;
  otherUser: AppUser;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="👋"
        title="No activity yet"
        description="Add your first shared expense to get started."
      />
    );
  }

  const groups = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const list = groups.get(item.date) ?? [];
    list.push(item);
    groups.set(item.date, list);
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([date, dayItems]) => (
        <div key={date}>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {formatDate(date)}
          </p>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {dayItems.map((item) =>
              item.kind === "transaction" ? (
                <TransactionRow
                  key={item.data.id}
                  transaction={item.data}
                  currentUser={currentUser}
                  otherUser={otherUser}
                />
              ) : (
                <PaymentRow key={item.data.id} payment={item.data} currentUser={currentUser} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
