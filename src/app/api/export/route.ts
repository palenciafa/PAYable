import { NextResponse } from "next/server";
import { generatePayableWorkbook } from "@/lib/excel/generate-export";
import {
  getAllUsers,
  getCategories,
  getCurrentAppUser,
  getPayments,
  getTransactions,
} from "@/lib/data/queries";
import { todayISO } from "@/lib/utils";

// GET /api/export — streams a fresh .xlsx snapshot of the shared ledger.
// Uses the normal (RLS-respecting) server client: any signed-in known
// user is already allowed to read the whole shared ledger under the
// policies in supabase/schema.sql, so no service-role key is needed here.
export async function GET() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const users = await getAllUsers();
  const otherUser = users.find((u) => u.id !== currentUser.id);
  if (!otherUser) {
    return NextResponse.json({ error: "A second user hasn't been set up yet" }, { status: 400 });
  }

  const [transactions, payments, categories] = await Promise.all([
    getTransactions(),
    getPayments(),
    getCategories(),
  ]);

  const buffer = await generatePayableWorkbook({
    currentUser,
    otherUser,
    transactions,
    payments,
    categories,
  });

  const filename = `PAYable-export-${todayISO()}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
