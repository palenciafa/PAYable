-- =====================================================================
-- Adds a self-managed OTP table.
--
-- PAYable now sends its own 6-digit verification codes via Brevo
-- instead of relying on Supabase Auth's built-in mailer. This table
-- holds the (hashed) pending code per email + purpose. It is only ever
-- read or written by the service-role client in src/lib/otp.ts, so RLS
-- is enabled with ZERO policies — that alone blocks every anon/
-- authenticated request; only the service role bypasses it.
--
-- Run this once in the Supabase SQL Editor, in addition to schema.sql.
-- =====================================================================

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('register', 'login')),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email, purpose)
);

alter table otp_codes enable row level security;
-- Intentionally no policies — only the service-role client (used
-- exclusively from server-only code in src/lib/otp.ts) can touch this
-- table at all.
