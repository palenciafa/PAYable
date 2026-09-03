import { formatCurrency } from "@/lib/utils";
import type { AppUser, PaymentWithUsers } from "@/types";
import { DeleteButton } from "./DeleteButton";
import { deletePayment } from "@/lib/actions/payments";

const METHOD_ICON: Record<string, string> = {
  Cash: "💵",
  GCash: "📱",
  "Bank Transfer": "🏦",
  Other: "💸",
};

export function PaymentRow({
  payment,
  currentUser,
  showDelete = false,
}: {
  payment: PaymentWithUsers;
  currentUser: AppUser;
  showDelete?: boolean;
}) {
  const iPaid = payment.from_user === currentUser.id;
  const from = payment.from_user_data;
  const to = payment.to_user_data;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-owed-light text-lg">
        {METHOD_ICON[payment.payment_method] ?? "💸"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {iPaid ? "You" : from.name} paid {iPaid ? to.name : "you"}
        </p>
        <p className="text-xs text-slate-500">
          {payment.payment_method}
          {payment.notes ? ` · ${payment.notes}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-sm font-medium text-owed">{formatCurrency(payment.amount_cents)}</p>
      {showDelete && (
        <DeleteButton
          action={async () => deletePayment(payment.id)}
          label="Delete"
          confirmTitle="Delete this payment?"
          confirmMessage="This will remove the settlement and recalculate the balance."
        />
      )}
    </div>
  );
}
