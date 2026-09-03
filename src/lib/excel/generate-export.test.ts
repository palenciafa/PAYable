import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generatePayableWorkbook } from "./generate-export";
import type { AppUser, Category, PaymentWithUsers, TransactionWithDetails } from "@/types";

const ME: AppUser = { id: "me-1", name: "Me", email: "me@example.com", avatar_url: null, created_at: "" };
const FRIEND: AppUser = { id: "friend-1", name: "Friend", email: "friend@example.com", avatar_url: null, created_at: "" };

const CATEGORIES: Category[] = [
  { id: "cat-food", name: "Food", icon: "🍔", sort_order: 1 },
  { id: "cat-transport", name: "Transportation", icon: "🚗", sort_order: 3 },
  { id: "cat-other", name: "Other", icon: "📦", sort_order: 9 },
];

const TRANSACTIONS: TransactionWithDetails[] = [
  {
    id: "t1",
    description: "McDonald's Dinner",
    category_id: "cat-food",
    total_amount_cents: 50000,
    paid_by: ME.id,
    date: "2026-09-03",
    notes: "Dinner after school",
    created_by: ME.id,
    created_at: "2026-09-03T00:00:00Z",
    updated_at: "2026-09-03T00:00:00Z",
    category: CATEGORIES[0]!,
    paid_by_user: ME,
    splits: [
      { id: "s1", transaction_id: "t1", user_id: ME.id, amount_cents: 25000, percentage: 50 },
      { id: "s2", transaction_id: "t1", user_id: FRIEND.id, amount_cents: 25000, percentage: 50 },
    ],
  },
  {
    id: "t2",
    description: "Grab ride",
    category_id: "cat-transport",
    total_amount_cents: 30000,
    paid_by: FRIEND.id,
    date: "2026-09-02",
    notes: null,
    created_by: FRIEND.id,
    created_at: "2026-09-02T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
    category: CATEGORIES[1]!,
    paid_by_user: FRIEND,
    splits: [
      { id: "s3", transaction_id: "t2", user_id: ME.id, amount_cents: 9000, percentage: 30 },
      { id: "s4", transaction_id: "t2", user_id: FRIEND.id, amount_cents: 21000, percentage: 70 },
    ],
  },
];

const PAYMENTS: PaymentWithUsers[] = [
  {
    id: "p1",
    from_user: FRIEND.id,
    to_user: ME.id,
    amount_cents: 10000,
    payment_method: "GCash",
    date: "2026-09-03",
    notes: "Partial settlement",
    created_at: "2026-09-03T00:00:00Z",
    from_user_data: FRIEND,
    to_user_data: ME,
  },
];

describe("generatePayableWorkbook", () => {
  it("produces a workbook with all five sheets, formulas, and correct raw values", async () => {
    const buffer = await generatePayableWorkbook({
      currentUser: ME,
      otherUser: FRIEND,
      transactions: TRANSACTIONS,
      payments: PAYMENTS,
      categories: CATEGORIES,
    });

    expect(buffer.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual([
      "Transactions",
      "Payments",
      "Summary",
      "Monthly Summary",
      "Category Summary",
    ]);

    // Transactions sheet: raw data + formula cells
    const txnSheet = wb.getWorksheet("Transactions")!;
    expect(txnSheet.getCell("B2").value).toBe("Grab ride"); // sorted by date ascending
    expect(txnSheet.getCell("B3").value).toBe("McDonald's Dinner");
    const youOweFormula = txnSheet.getCell("H2").value as { formula: string };
    expect(youOweFormula.formula).toContain("IF(D2=");

    // Payments sheet
    const paySheet = wb.getWorksheet("Payments")!;
    expect(paySheet.getCell("B2").value).toBe("Friend");
    expect(paySheet.getCell("D2").value).toBe(100); // 10000 cents -> 100 pesos

    // Summary sheet has formula cells, not hardcoded numbers
    const summary = wb.getWorksheet("Summary")!;
    let foundFormula = false;
    summary.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value) {
          foundFormula = true;
        }
      });
    });
    expect(foundFormula).toBe(true);

    // Monthly Summary references SUMIFS
    const monthly = wb.getWorksheet("Monthly Summary")!;
    const monthCell = monthly.getCell("B2").value as { formula: string };
    expect(monthCell.formula).toContain("SUMIFS");

    // Category Summary references SUMIF per category
    const catSheet = wb.getWorksheet("Category Summary")!;
    const catCell = catSheet.getCell("B2").value as { formula: string };
    expect(catCell.formula).toContain("SUMIF");
  });
});
