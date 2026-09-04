"use server";

import type { User } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  registerRequestSchema,
  loginCodeRequestSchema,
  emailOtpVerifySchema,
} from "@/lib/validation";
import { generateCode, storeOtp, verifyAndConsumeOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email/brevo";

export type OtpMode = "register" | "login";
export type OtpActionResult = { success: true } | { success: false; error: string };

/**
 * Step 1 of each flow — generates a 6-digit code, stores its hash, and
 * emails it via Brevo (see src/lib/email/brevo.ts and src/lib/otp.ts).
 * Supabase Auth is still where the account itself lives, but Supabase's
 * own mailer is no longer used for delivery.
 *
 *  - mode "register": creates (or reuses, if this is a resend) an
 *    unconfirmed Supabase auth account. There is no seat limit — every
 *    verified registration is added to the shared `users` table.
 *  - mode "login": passwordless code for an EXISTING app user only —
 *    the "Email code" tab on /login, alongside the password tab.
 */
export async function requestEmailCode(
  mode: OtpMode,
  input: { email: string; name?: string; password?: string }
): Promise<OtpActionResult> {
  const admin = createAdminClient();

  if (mode === "register") {
    const parsed = registerRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const { email, name, password } = parsed.data;

    const { data: existingAppUser } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingAppUser) {
      return {
        success: false,
        error: "That email is already registered — try signing in instead.",
      };
    }

    const existingAuthUser = await findAuthUserByEmail(email);
    if (existingAuthUser) {
      // Resending a code for an unverified signup — keep the same
      // account, just refresh the password in case they retyped it.
      const { error } = await admin.auth.admin.updateUserById(existingAuthUser.id, { password });
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { name },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          return {
            success: false,
            error: "That email is already registered — try signing in instead.",
          };
        }
        return { success: false, error: error.message || "Couldn't create your account. Try again." };
      }
    }

    const code = generateCode();
    await storeOtp(email, "register", code);
    await sendOtpEmail(email, code, { name });
    return { success: true };
  }

  const parsed = loginCodeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email } = parsed.data;

  const { data: appUser } = await admin
    .from("users")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();
  if (!appUser) {
    return {
      success: false,
      error: "We couldn't find an account for that email. Try creating one instead.",
    };
  }

  const code = generateCode();
  await storeOtp(email, "login", code);
  await sendOtpEmail(email, code, { name: appUser.name });
  return { success: true };
}

/**
 * Step 2 — verifies the 6-digit code against the hash stored by
 * requestEmailCode.
 *  - mode "register": confirms the Supabase auth account and inserts it
 *    into the shared `users` table — unconditionally, no seat cap. The
 *    flow ends at "go log in", not an automatic session, so the person
 *    always lands on /login next.
 *  - mode "login": this IS the sign-in. Since the person already proved
 *    they own the inbox via our own code (not Supabase's), we establish
 *    their session via an admin-generated magic-link token, verified
 *    through the normal cookie-writing client.
 */
export async function verifyEmailCode(
  mode: OtpMode,
  input: { email: string; token: string }
): Promise<OtpActionResult> {
  const parsed = emailOtpVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, token } = parsed.data;

  const ok = await verifyAndConsumeOtp(email, mode, token);
  if (!ok) {
    return { success: false, error: "That code is incorrect or has expired. Request a new one." };
  }

  const admin = createAdminClient();

  if (mode === "register") {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      return { success: false, error: "Something went wrong — please register again." };
    }

    await admin.auth.admin.updateUserById(authUser.id, { email_confirm: true });

    const name = (authUser.user_metadata as { name?: string } | null)?.name;
    const { error } = await admin.from("users").insert({
      id: authUser.id,
      name: name?.trim() || email.split("@")[0],
      email,
    });
    // A duplicate here just means a retried/resent verify raced itself —
    // the row already exists, which is the outcome we wanted anyway.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { success: false, error: "Couldn't sign you in. Try the password tab instead." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    return { success: false, error: "Couldn't sign you in. Try the password tab instead." };
  }

  return { success: true };
}

/**
 * Fine at PAYable's scale (a handful of accounts). If this ever grows
 * past a couple hundred users, page through listUsers() instead.
 */
async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}
