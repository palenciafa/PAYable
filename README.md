# PAYable

A private, shared expense tracker for two people. Track who paid, who owes
who, settle up, and export everything to a live-formula Excel workbook.

Built with Next.js (App Router) + TypeScript + Tailwind CSS + Supabase
(Postgres + Auth) + ExcelJS + Recharts.

---

## 1. How the money math works (read this first)

**The balance is never stored.** There is no `amount_owed` column anywhere.
Every screen — dashboard, transaction detail, monthly summary, and the
Excel export — derives the balance the same way, from three inputs:

1. Every transaction's **total**, **who paid**, and each person's **share**
   (`transaction_splits`)
2. Every **payment** (settlement) between the two people
3. One function: [`calculateBalance()`](src/lib/balance.ts)

```
grossOwedToMe = sum of the other person's share, for every transaction I paid
grossIOwe     = sum of my share, for every transaction the other person paid
net = (grossOwedToMe - paymentsTheyMadeToMe) - (grossIOwe - paymentsIMadeToThem)

net > 0  → they owe you `net`
net < 0  → you owe them `-net`
net = 0  → settled up
```

All money is stored as **integer centavos** (`bigint`), never floats, to
avoid rounding bugs. `src/lib/utils.ts` converts to/from decimal pesos only
at the UI boundary. Splits are validated in three places: the form
(client), `zod` (server action), and a Postgres trigger
(`check_splits_sum_to_total`) that makes it structurally impossible for
splits to not sum to the transaction total, no matter what inserts the row.

See `src/lib/balance.test.ts` for the six required test scenarios (and a
few extra) — run them with `npm test`.

---

## 2. Project structure

```
supabase/schema.sql          Full DB schema, RLS policies, seed categories
src/types/index.ts           Shared TypeScript types (all money in cents)
src/lib/
  balance.ts                 THE balance calculation (single source of truth)
  balance.test.ts            Unit tests for balance.ts
  utils.ts                   Currency/date formatting, cents<->pesos
  validation.ts               Zod schemas for forms/server actions
  supabase/                  Browser client, server client, middleware helper
  data/queries.ts             All read queries (Server Components call these)
  actions/                   Server actions (writes): transactions, payments
  excel/
    generate-export.ts       ExcelJS workbook builder (5 sheets, formulas)
    generate-export.test.ts  Smoke test for the export
src/components/              Reusable UI (forms, rows, charts, ui/ primitives)
src/app/
  page.tsx                  Dashboard
  login/                    Sign-in
  transactions/             List, detail, new, edit
  payments/                 List, new
  analytics/                Monthly + category analytics
  api/export/route.ts       GET -> streams a fresh .xlsx
```

---

## 3. Supabase setup

### 3.1 Create a project
Go to [supabase.com](https://supabase.com), create a new project, and note
your **Project URL**, **anon public key**, and **service_role key**
(Project Settings → API).

### 3.2 Run the schema
Open the Supabase SQL Editor and run the entire contents of
[`supabase/schema.sql`](supabase/schema.sql). This creates all tables,
indexes, the split-sum trigger, the `pairwise_debts` view, and Row Level
Security policies, and seeds the nine default categories.

### 3.3 Create the two auth users
In Supabase Dashboard → Authentication → Users → **Add user**, create one
account for you and one for your friend (email + password is simplest).
Copy each user's UUID.

### 3.4 Seed the `users` table
Back in the SQL Editor:

```sql
insert into users (id, name, email) values
  ('<your-auth-uuid>', 'Me', 'you@example.com'),
  ('<friends-auth-uuid>', 'Friend', 'friend@example.com');
```

Use whatever display names you actually want — they show up everywhere in
the app and in the Excel export.

---

## 4. Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> The service-role key is included for completeness but nothing in this
> app currently needs it — the export route reads data as the signed-in
> user under RLS, same as every other page. **Never** expose this key to
> the client or import it into a Client Component.

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with one of the two accounts you
created, and start tracking.

Run the test suite any time with:

```bash
npm test
```

---

## 5. Adding a transaction

- **Description**, **category**, **total amount**, **who paid**, **date**,
  optional **notes**.
- **Split**: 50/50, custom pesos, or percentage. The form previews each
  person's share live and blocks submission if custom/percentage shares
  don't add up to the total. 50/50 rounds the odd centavo to whoever paid
  isn't relevant here — it's assigned deterministically (first user id) so
  the split is always exact.

## 6. Recording a payment

Payments are **settlements**, not expenses — they reduce an existing debt,
they never appear as spending in analytics or category charts. If a
payment is larger than the current debt in that direction, PAYable doesn't
error: it just lets the net balance flip the other way, exactly like real
life ("you overpaid, now I owe you").

## 7. Excel export

`GET /api/export` (the **Export to Excel** button) generates a fresh
`.xlsx` on every click, with five sheets:

| Sheet | Contents |
|---|---|
| **Summary** | Totals, net balance — all live formulas over the other sheets |
| **Transactions** | Every transaction; "You Owe" / "Friend Owes" / "Status" are formulas driven by the "Paid By" column, not hardcoded |
| **Payments** | Every settlement |
| **Monthly Summary** | One row per month, one column per category, via `SUMIFS` |
| **Category Summary** | Total per category via `SUMIF` |

Currency is formatted `₱#,##0.00`, header rows are frozen and bold,
autofilter is enabled on the data sheets, and the Summary sheet's net
balance is conditionally colored (green/red). Because these are real
Excel formulas (not pasted-in values), editing a row in **Transactions**
after export — e.g. fixing a typo'd amount — automatically updates every
number in **Summary**, **Monthly Summary**, and **Category Summary** the
next time you open the file in Excel or Google Sheets.

---

## 8. Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [vercel.com/new](https://vercel.com/new).
3. Add the three environment variables from step 4 in Vercel's Project
   Settings → Environment Variables.
4. Deploy. No other configuration is required — the app is a standard
   Next.js App Router project.

---

## 9. Design decisions worth knowing about

- **Two users today, N users later**: `transaction_splits` is a per-user
  row, not fixed `me_share`/`friend_share` columns, and `payments` uses
  generic `from_user`/`to_user`. Nothing in the schema hardcodes "two
  people" — `calculateBalance()` is the only place that's currently
  two-person-specific (it computes one pairwise balance), and it's
  isolated enough to extend into a full N-person ledger later without
  touching the schema.
- **RLS model**: every signed-in *known* user (present in the `users`
  table) can read and write all shared-ledger data — that's the point of
  a shared, two-person ledger. RLS's job here is keeping out anyone who
  isn't one of the app's known users, not partitioning data between the
  two of you.
- **Why cents, not decimals or floats**: Postgres `bigint` + JS integers
  avoid the classic `0.1 + 0.2 !== 0.3` class of bug entirely. Every
  monetary column is suffixed `_cents` as a reminder.
- **Split validation happens three times on purpose**: instant feedback
  in the form, a real rejection in the server action if someone bypasses
  the UI, and a Postgres trigger as the last line of defense — the
  database itself will refuse to save mismatched splits.

---

## 11. Mobile / iOS friendliness

PAYable is designed to feel like a native-ish app when used on an iPhone,
whether that's Safari or "Add to Home Screen":

- **Add to Home Screen**: `public/manifest.json` + Apple meta tags in
  `layout.tsx` mean iOS shows PAYable's own icon (`public/apple-touch-icon.png`)
  and a standalone, browser-chrome-free window when launched from the home
  screen, with a dark translucent status bar to match the navbar.
- **Bottom tab bar** (`src/components/BottomNav.tsx`): below the `sm`
  breakpoint, navigation moves to a fixed iOS-style tab bar at the bottom
  of the screen instead of the desktop top nav, with safe-area padding so
  it never sits under the home indicator on notched iPhones.
- **Safe areas**: `viewport-fit=cover` plus `env(safe-area-inset-*)`
  padding on the sticky header and bottom nav keep content clear of the
  notch/Dynamic Island and the home-indicator bar.
- **No accidental zoom**: every form input is set to 16px, the minimum
  iOS Safari won't auto-zoom into on focus — so filling out the "Add
  Transaction" or "Record Payment" forms doesn't jump the viewport around.
- **44pt tap targets**: buttons and inputs use Apple's minimum recommended
  hit-area size (`min-h-[44px]`), and `touch-action: manipulation` removes
  the ~300ms tap delay and double-tap-to-zoom on buttons.
- **Native-feeling pickers**: date fields use `<input type="date">` (iOS's
  built-in wheel picker) and amount fields use `inputMode="decimal"` to
  bring up the numeric keypad instead of the full keyboard.
- To swap in your own icon, replace the files in `public/` (`apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) — keep the same
  filenames and sizes and `manifest.json` needs no changes.

---

## 12. Test cases covered

All six scenarios from the spec (plus overpay/round-trip settlement
edge cases) are asserted in `src/lib/balance.test.ts`:

1. You pay ₱500, 50/50 → friend owes you ₱250
2. Friend pays ₱500, 50/50 → you owe friend ₱250
3. You pay ₱1,000, custom 300/700 → friend owes you ₱700
4. Friend owes you ₱1,000, friend pays ₱600 → friend owes you ₱400
5. You owe friend ₱500, you pay ₱500 → settled
6. Multiple transactions in both directions net to one correct balance

Run `npm test` to see them all pass.
