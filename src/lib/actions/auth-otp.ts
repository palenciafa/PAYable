"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { emailOtpRequestSchema, emailOtpVerifySchema } from "@/lib/validation";

export type OtpMode = "register" | "login";

export type OtpActionResult = { success: true } | { success: false; error: string };

/**
 * Sends a 6-digit email code via Supabase Auth.
 *  - mode "register": creates the auth user if they don't exist yet
 *    (shouldCreateUser: true) and stashes the display name in
 *    user_metadata so we can use it when provisioning below.
 *  - mode "login": never creates an account. If the email has no
 *    existing auth user, Supabase rejects the request and we surface a
 *    friendly nudge toward /register instead.
 *
 * Requires Supabase's "Confirm signup" / "Magic Link" email templates to
 * include {{ .Token }} — see README "Email OTP setup".
 */
export async function requestEmailCode(
  mode: OtpMode,
  input: { email: string; name?: string }
): Promise<OtpActionResult> {
  const parsed = emailOtpRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (mode === "register" && !parsed.data.name) {
    return { success: false, error: "Enter your name" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: mode === "register",
      data: mode === "register" ? { name: parsed.data.name } : undefined,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (mode === "login" && (msg.includes("not found") || msg.includes("not allowed") || msg.includes("signups"))) {
      return {
        success: false,
        error: "We couldn't find an account for that email. Try creating one instead.",
      };
    }
    return { success: false, error: error.message || "Couldn't send a code. Try again." };
  }

  return { success: true };
}

/** Verifies the 6-digit code and, for registration, provisions the app-level user row. */
export async function verifyEmailCode(
  mode: OtpMode,
  input: { email: string; token: string; name?: string }
): Promise<OtpActionResult> {
  const parsed = emailOtpVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error || !data.user) {
    return { success: false, error: "That code is incorrect or has expired. Request a new one." };
  }

  if (mode === "register") {
    // Provisioning failure (e.g. the two seats are already taken) still
    // leaves the person signed in with a valid auth account — the
    // dashboard already explains what to do next in that case, so we
    // don't treat it as a hard failure here.
    await provisionIfSlotAvailable(data.user.id, parsed.data.email, parsed.data.name);
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
