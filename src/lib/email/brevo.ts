// Sends PAYable's own OTP codes via Brevo's transactional email API,
// instead of relying on Supabase Auth's built-in mailer. Requires
// BREVO_API_KEY and BREVO_SENDER_EMAIL in the environment. The sender
// address must be a verified sender (or domain) in your Brevo account,
// or Brevo will reject the send.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendOtpEmail(
  to: string,
  code: string,
  opts?: { name?: string }
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "PAYable";

  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not set");

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, name: opts?.name || undefined }],
      subject: "Your PAYable verification code",
      htmlContent: `
        <div style="font-family: sans-serif; font-size: 15px; color: #1e293b;">
          <p>${opts?.name ? `Hi ${opts.name},` : "Hi,"}</p>
          <p>Your PAYable verification code is:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">
            ${code}
          </p>
          <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${body}`);
  }
}
