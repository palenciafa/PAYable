"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEmailCode, verifyEmailCode, type OtpMode } from "@/lib/actions/auth-otp";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function EmailCodeForm({ mode }: { mode: OtpMode }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"request" | "code">("request");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestEmailCode(mode, {
        email,
        name: isRegister ? name : undefined,
        password: isRegister ? password : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setInfo(`We sent a 6-digit code to ${email}.`);
      setStep("code");
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyEmailCode(mode, { email, token });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (isRegister) {
        // Registration ends at "go log in", not an automatic session —
        // see verifyEmailCode's comment for why.
        router.push("/login?registered=1");
      } else {
        router.push("/");
        router.refresh();
      }
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await requestEmailCode(mode, {
        email,
        name: isRegister ? name : undefined,
        password: isRegister ? password : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setInfo(`Sent a new code to ${email}.`);
    });
  }

  if (step === "request") {
    return (
      <form onSubmit={handleRequest} className="space-y-4">
        {isRegister && (
          <div>
            <label className="label" htmlFor="otp-name">Your name</label>
            <Input
              id="otp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Franchielle"
              required
              autoFocus
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="otp-email">Email</label>
          <Input
            id="otp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus={!isRegister}
          />
        </div>
        {isRegister && (
          <div>
            <label className="label" htmlFor="otp-password">Password</label>
            <Input
              id="otp-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
        )}
        {error && <p className="text-sm text-owe">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      {info && <p className="text-sm text-slate-500">{info}</p>}
      <div>
        <label className="label" htmlFor="otp-token">6-digit code</label>
        <Input
          id="otp-token"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          required
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-owe">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending || token.length !== 6}>
        {isPending ? "Verifying…" : isRegister ? "Verify email" : "Verify & sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("request");
            setToken("");
            setError(null);
            setInfo(null);
          }}
          className="text-slate-500 hover:underline"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={isPending}
          className="text-brand-600 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
