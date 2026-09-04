// Self-managed OTP codes, now that PAYable sends its own verification
// emails via Brevo instead of Supabase Auth's mailer. Codes are hashed
// at rest (never stored in plaintext) and live in the `otp_codes` table,
// which has RLS enabled with zero policies — only the service-role
// (admin) client used here can ever touch it.
import { createHash, randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";

export type OtpPurpose = "register" | "login";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Creates or replaces the pending code for this email + purpose. */
export async function storeOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  const admin = createAdminClient();
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const { error } = await admin.from("otp_codes").upsert(
    {
      email: email.toLowerCase(),
      purpose,
      code_hash: hashCode(code),
      expires_at,
      attempts: 0,
    },
    { onConflict: "email,purpose" }
  );
  if (error) throw error;
}

/**
 * Checks a code against the stored hash, consuming (deleting) it on
 * success, expiry, or once MAX_ATTEMPTS wrong guesses have been made.
 * Returns whether the code was valid.
 */
export async function verifyAndConsumeOtp(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<boolean> {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  const { data, error } = await admin
    .from("otp_codes")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("purpose", purpose)
    .maybeSingle();

  if (error || !data) return false;

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const tooManyAttempts = data.attempts >= MAX_ATTEMPTS;
  if (expired || tooManyAttempts) {
    await admin.from("otp_codes").delete().eq("email", normalizedEmail).eq("purpose", purpose);
    return false;
  }

  const matches = data.code_hash === hashCode(code);
  if (!matches) {
    await admin
      .from("otp_codes")
      .update({ attempts: data.attempts + 1 })
      .eq("email", normalizedEmail)
      .eq("purpose", purpose);
    return false;
  }

  await admin.from("otp_codes").delete().eq("email", normalizedEmail).eq("purpose", purpose);
  return true;
}
