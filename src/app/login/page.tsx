"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmailCodeForm } from "@/components/auth/EmailCodeForm";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, null);
  const [tab, setTab] = useState<"password" | "code">("password");

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-semibold text-white">
            ₱
          </span>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Welcome to PAYable</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to see who owes who.</p>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === "code" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Email code
          </button>
        </div>

        {tab === "password" ? (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>

            {state?.error && <p className="text-sm text-owe">{state.error}</p>}

            <SubmitButton />
          </form>
        ) : (
          <EmailCodeForm mode="login" />
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
