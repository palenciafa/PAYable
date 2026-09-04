"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  registerRequestSchema,
  loginCodeRequestSchema,
  emailOtpVerifySchema,
} from "@/lib/validation";

export type OtpMode = "register" | "login";

export type OtpActionResult = { success: true } | { success: false; error: string };

/**
 * Step 1 of each flow — sends a 6-digit email code.
 *  - mode "register": creates the auth account with the given password
 *    via signUp(). The account stays unconfirmed (can't sign in yet)
 *    until the code from this email is verified in step 2. Requires
 *    Supabase's "Confirm email" setting to be on — see README §3.5.
 *  - mode "login": passwordless code for an EXISTING account only
 *    (shouldCreateUser: false) — used by the "Email code" tab on
 *    /login as an alternative to a password, not for new accounts.
 */
export async function requestEmailCode(
  mode: OtpMode,
  input: { email: string; name?: string; password?: string }
): Promise<OtpActionResult> {
  const supabase = await createClient();

  if (mode === "register") {
    const parsed = registerRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { name: parsed.data.name } },
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
    return { success: true };
  }

  const parsed = loginCodeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("not found") || msg.includes("not allowed") || msg.includes("signups")) {
      return {
        success: false,
        error: "We couldn't find an account for that email. Try creating one instead.",
      };
    }
    return { success: false, error: error.message || "Couldn't send a code. Try again." };
  }

  return { success: true };
}

/**
 * Step 2 — verifies the 6-digit code.
 *  - mode "register": confirms the signup (type "signup"), provisions
 *    the app-level `users` row if a seat is free, then deliberately
 *    signs the browser back out. The flow is register -> verify ->
 *    LOG IN -> dashboard, not an automatic sign-in after verifying.
 *  - mode "login": confirms the passwordless code (type "email") and
 *    leaves the resulting session in place — this IS the sign-in.
 */
export async function verifyEmailCode(
  mode: OtpMode,
  input: { email: string; token: string }
): Promise<OtpActionResult> {
  const parsed = emailOtpVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: mode === "register" ? "signup" : "email",
  });

  if (error || !data.user) {
    return { success: false, error: "That code is incorrect or has expired. Request a new one." };
  }

  if (mode === "register") {
    const name = (data.user.user_metadata as { name?: string } | null)?.name;
    // Provisioning failure (e.g. the two seats are already taken) still
    // leaves the person with a valid, confirmed account — the dashboard
    // already explains what to do next in that case, so it isn't
    // treated as a hard failure here.
    await provisionIfSlotAvailable(data.user.id, parsed.data.email, name);

    // verifyOtp() establishes a session as a side effect of confirming
    // the account. Registration is meant to end at "go log in", not at
    // "you're already in", so undo that session immediately.
    await supabase.auth.signOut();
  }

  return { success: true };
}

/**
 * Adds the newly-verified auth user to the shared `users` table, but
 * only if fewer than two people are set up already — PAYable is a
 * two-person ledger, so registration is capped at two seats. Uses the
 * service-role client because a brand-new, not-yet-provisioned account
 * has no RLS access to `users` (by design — see is_known_user() in
 * schema.sql), so this bootstrap step can't go through the normal
 * RLS-respecting client.
 */
async function provisionIfSlotAvailable(
  userId: string,
  email: string,
  name?: string
): Promise<OtpActionResult> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (existing) return { success: true };

  const { count } = await admin.from("users").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 2) {
    return { success: false, error: "PAYable already has two people set up." };
  }

  const { error } = await admin.from("users").insert({
    id: userId,
    name: name?.trim() || email.split("@")[0],
    email,
  });
  if (error) return { success: false, error: error.message };

  return { success: true };
}
