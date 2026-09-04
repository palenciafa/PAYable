import Link from "next/link";
import { EmailCodeForm } from "@/components/auth/EmailCodeForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-semibold text-white">
            ₱
          </span>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Create your PAYable account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set a password, verify your email with a 6-digit code, then sign in.
          </p>
        </div>

        <EmailCodeForm mode="register" />

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
