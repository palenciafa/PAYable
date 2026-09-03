"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";

/**
 * A destructive-action button that always confirms first via an inline
 * modal, then calls the given server action and refreshes the route.
 */
export function DeleteButton({
  action,
  label = "Delete",
  confirmTitle = "Delete this?",
  confirmMessage = "This can't be undone.",
  redirectTo,
}: {
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  label?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action(new FormData());
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)} type="button">
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-slide-up">
            <h3 className="text-base font-semibold text-slate-900">{confirmTitle}</h3>
            <p className="mt-1.5 text-sm text-slate-500">{confirmMessage}</p>
            {error && <p className="mt-2 text-sm text-owe">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="danger" type="button" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Deleting…" : "Yes, delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
