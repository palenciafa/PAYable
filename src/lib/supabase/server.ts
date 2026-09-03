// Server-side Supabase client for use in Server Components, Server
// Actions, and Route Handlers. Reads the session from cookies and
// respects Row Level Security using the signed-in user's identity —
// it does NOT use the service role key, so RLS is always enforced.
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to; safe to ignore because middleware refreshes
            // the session on every request anyway.
          }
        },
      },
    }
  );
}

// Admin client using the service role key. ONLY ever import this from
// server-only code (route handlers), never from a component that could
// be bundled for the client. Used solely for the Excel export, which
// needs a reliable full read of the shared ledger from a trusted
// server context. It still only ever reads data any signed-in app
// user is already allowed to see under RLS.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
