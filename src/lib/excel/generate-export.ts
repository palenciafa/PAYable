import ExcelJS from "exceljs";
import type { AppUser, Category, PaymentWithUsers, TransactionWithDetails } from "@/types";
import { centsToPesos } from "@/lib/utils";

// All formulas below use a generous fixed range (row 2 through MAX_ROW) rather
// than the exact row count, so the workbook keeps calculating correctly if
// the person pastes in new rows by hand later — the same reason we point
// SUM/SUMIF/SUMIFS at a wide range instead of a tight one tied to today's
// row count.
const MAX_ROW = 1000;
const PESO_FORMAT = '"₱"#,##0.00';

const CATEGORY_ORDER = [
  "Food",
  "Groceries",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Household",
  "Subscriptions",
  "Gifts",
  "Other",
];

function headerRow(sheet: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2A3A" } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: row.number, xSplit: 0 }];
}

export async function generatePayableWorkbook(params: {
  currentUser: AppUser;
  otherUser: AppUser;
  transactions: TransactionWithDetails[];
  payments: PaymentWithUsers[];
  categories: Category[];
}): Promise<ExcelJS.Buffer> {
  const { currentUser, otherUser, transactions, payments, categories } = params;
  const meName = currentUser.name;
  const friendName = otherUser.name;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PAYable";
  workbook.created = new Date();

  // -------------------------------------------------------------------
  // SHEET 2 — TRANSACTIONS  (built first; Summary/Monthly/Category read it)
  // -------------------------------------------------------------------
  const txnSheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  txnSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "description", width: 28 },
    { header: "Category", key: "category", width: 16 },
    { header: "Paid By", key: "paidBy", width: 14 },
    { header: "Total Amount", key: "total", width: 15 },
    { header: "Your Share", key: "myShare", width: 14 },
    { header: "Friend Share", key: "friendShare", width: 14 },
    { header: "You Owe", key: "youOwe", width: 14 },
    { header: "Friend Owes", key: "friendOwes", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Notes", key: "notes", width: 26 },
  ];
  headerRow(txnSheet, txnSheet.getRow(1));

  const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  sortedTxns.forEach((t, i) => {
    const row = i + 2;
    const paidByName = t.paid_by === currentUser.id ? meName : friendName;
    const myShare = t.splits.find((s) => s.user_id === currentUser.id)?.amount_cents ?? 0;
    const friendShare = t.splits.find((s) => s.user_id === otherUser.id)?.amount_cents ?? 0;

    txnSheet.getRow(row).values = {
      date: new Date(t.date + "T00:00:00"),
      description: t.description,
      category: t.category.name,
      paidBy: paidByName,
      total: centsToPesos(t.total_amount_cents),
      myShare: centsToPesos(myShare),
      friendShare: centsToPesos(friendShare),
      youOwe: { formula: `IF(D${row}="${friendName}",F${row},0)` },
      friendOwes: { formula: `IF(D${row}="${meName}",G${row},0)` },
      status: {
        formula: `IF(H${row}>0,"You owe",IF(I${row}>0,"${friendName} owes you","Even"))`,
      },
      notes: t.notes ?? "",
    };
  });

  ["E", "F", "G", "H", "I"].forEach((col) => {
    txnSheet.getColumn(col).numFmt = PESO_FORMAT;
  });
  txnSheet.getColumn("A").numFmt = "yyyy-mm-dd";
  txnSheet.autoFilter = { from: "A1", to: `K${Math.max(sortedTxns.length + 1, 1)}` };

  // -------------------------------------------------------------------
  // SHEET 3 — PAYMENTS
  // -------------------------------------------------------------------
  const paySheet = workbook.addWorksheet("Payments", { views: [{ state: "frozen", ySplit: 1 }] });
  paySheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "From", key: "from", width: 14 },
    { header: "To", key: "to", width: 14 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Payment Method", key: "method", width: 18 },
    { header: "Notes", key: "notes", width: 28 },
  ];
  headerRow(paySheet, paySheet.getRow(1));

  const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  sortedPayments.forEach((p, i) => {
    const row = i + 2;
    paySheet.getRow(row).values = {
      date: new Date(p.date + "T00:00:00"),
      from: p.from_user_data.name,
      to: p.to_user_data.name,
      amount: centsToPesos(p.amount_cents),
      method: p.payment_method,
      notes: p.notes ?? "",
    };
  });
  paySheet.getColumn("D").numFmt = PESO_FORMAT;
  paySheet.getColumn("A").numFmt = "yyyy-mm-dd";
  paySheet.autoFilter = { from: "A1", to: `F${Math.max(sortedPayments.length + 1, 1)}` };

  // -------------------------------------------------------------------
  // SHEET 1 — SUMMARY
  // -------------------------------------------------------------------
  const summary = workbook.addWorksheet("Summary");
  summary.getColumn("A").width = 30;
  summary.getColumn("B").width = 18;

  summary.mergeCells("A1:B1");
  const title = summary.getCell("A1");
  title.value = "PAYable — Money Tracker";
  title.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2A3A" } };
  title.alignment = { vertical: "middle" };
  summary.getRow(1).height = 30;

  summary.getCell("A2").value = `Between ${meName} and ${friendName}`;
  summary.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };
  summary.mergeCells("A2:B2");

  type Line = { label: string; formula: string; bold?: boolean; tone?: "owe" | "owed" };
  const lines: Line[] = [
    { label: "Total Shared Expenses", formula: `SUM(Transactions!E2:E${MAX_ROW})` },
    {
      label: `${meName} Paid`,
      formula: `SUMIF(Transactions!D2:D${MAX_ROW},"${meName}",Transactions!E2:E${MAX_ROW})`,
    },
    {
      label: `${friendName} Paid`,
      formula: `SUMIF(Transactions!D2:D${MAX_ROW},"${friendName}",Transactions!E2:E${MAX_ROW})`,
    },
    { label: "Total Payments Recorded", formula: `SUM(Payments!D2:D${MAX_ROW})` },
  ];

  // Net balance = (gross owed to me - payments made to me) - (gross I owe - payments I made)
  // Mirrors src/lib/balance.ts::calculateBalance exactly.
  const netFormula =
    `(SUM(Transactions!I2:I${MAX_ROW})-SUMIF(Payments!B2:B${MAX_ROW},"${friendName}",Payments!D2:D${MAX_ROW}))` +
    `-(SUM(Transactions!H2:H${MAX_ROW})-SUMIF(Payments!B2:B${MAX_ROW},"${meName}",Payments!D2:D${MAX_ROW}))`;

  let r = 4;
  for (const line of lines) {
    summary.getCell(`A${r}`).value = line.label;
    const cell = summary.getCell(`B${r}`);
    cell.value = { formula: line.formula };
    cell.numFmt = PESO_FORMAT;
    r++;
  }

  r++; // spacer
  summary.getCell(`A${r}`).value = "You Owe Friend";
  summary.getCell(`A${r}`).font = { bold: true };
  const youOweCell = summary.getCell(`B${r}`);
  youOweCell.value = { formula: `IF((${netFormula})<0,-(${netFormula}),0)` };
  youOweCell.numFmt = PESO_FORMAT;
  youOweCell.font = { bold: true, color: { argb: "FF991B1B" } };
  r++;

  summary.getCell(`A${r}`).value = "Friend Owes You";
  summary.getCell(`A${r}`).font = { bold: true };
  const friendOwesCell = summary.getCell(`B${r}`);
  friendOwesCell.value = { formula: `IF((${netFormula})>0,(${netFormula}),0)` };
  friendOwesCell.numFmt = PESO_FORMAT;
  friendOwesCell.font = { bold: true, color: { argb: "FF166534" } };
  r++;

  r++; // spacer
  summary.getCell(`A${r}`).value = "Net Balance";
  summary.getCell(`A${r}`).font = { bold: true, size: 12 };
  const netCell = summary.getCell(`B${r}`);
  netCell.value = { formula: netFormula };
  netCell.numFmt = PESO_FORMAT;
  netCell.font = { bold: true, size: 12 };
  const netRow = r;

  summary.getCell(`A${netRow + 2}`).value =
    "Positive net balance = your friend owes you. Negative = you owe your friend.";
  summary.getCell(`A${netRow + 2}`).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };
  summary.mergeCells(`A${netRow + 2}:B${netRow + 2}`);

  // Conditional formatting: green when the net figure favors you, red when it doesn't.
  summary.addConditionalFormatting({
    ref: `B${netRow}`,
    rules: [
      { type: "cellIs", operator: "greaterThan", formulae: ["0"], style: { font: { color: { argb: "FF166534" } } }, priority: 1 },
      { type: "cellIs", operator: "lessThan", formulae: ["0"], style: { font: { color: { argb: "FF991B1B" } } }, priority: 2 },
    ],
  });

  // -------------------------------------------------------------------
  // SHEET 4 — MONTHLY SUMMARY
  // -------------------------------------------------------------------
  const monthly = workbook.addWorksheet("Monthly Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  const monthlyHeaders = ["Month", ...CATEGORY_ORDER, "Total"];
  monthly.columns = monthlyHeaders.map((h) => ({ header: h, key: h, width: h === "Month" ? 14 : 15 }));
  headerRow(monthly, monthly.getRow(1));

  const months = Array.from(new Set(transactions.map((t) => t.date.slice(0, 7)))).sort();
  const monthList = months.length > 0 ? months : [new Date().toISOString().slice(0, 7)];

  monthList.forEach((m, i) => {
    const row = i + 2;
    const [y, mo] = m.split("-").map(Number);
    const startDate = `DATE(${y},${mo},1)`;
    const endDate = mo === 12 ? `DATE(${y! + 1},1,1)` : `DATE(${y},${mo! + 1},1)`;

    monthly.getCell(row, 1).value = m;
    CATEGORY_ORDER.forEach((cat, ci) => {
      const col = ci + 2;
      const cell = monthly.getCell(row, col);
      cell.value = {
        formula:
          `SUMIFS(Transactions!$E$2:$E$${MAX_ROW},` +
          `Transactions!$C$2:$C$${MAX_ROW},"${cat}",` +
          `Transactions!$A$2:$A$${MAX_ROW},">="&${startDate},` +
          `Transactions!$A$2:$A$${MAX_ROW},"<"&${endDate})`,
      };
      cell.numFmt = PESO_FORMAT;
    });
    const totalCol = CATEGORY_ORDER.length + 2;
    const totalCell = monthly.getCell(row, totalCol);
    const firstCatCol = colLetter(2);
    const lastCatCol = colLetter(CATEGORY_ORDER.length + 1);
    totalCell.value = { formula: `SUM(${firstCatCol}${row}:${lastCatCol}${row})` };
    totalCell.numFmt = PESO_FORMAT;
    totalCell.font = { bold: true };
  });

  // -------------------------------------------------------------------
  // SHEET 5 — CATEGORY SUMMARY
  // -------------------------------------------------------------------
  const catSheet = workbook.addWorksheet("Category Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  catSheet.columns = [
    { header: "Category", key: "category", width: 20 },
    { header: "Total", key: "total", width: 16 },
  ];
  headerRow(catSheet, catSheet.getRow(1));

  const orderedCategories = categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  orderedCategories.forEach((cat, i) => {
    const row = i + 2;
    catSheet.getCell(`A${row}`).value = `${cat.icon} ${cat.name}`;
    const cell = catSheet.getCell(`B${row}`);
    cell.value = {
      formula: `SUMIF(Transactions!$C$2:$C$${MAX_ROW},"${cat.name}",Transactions!$E$2:$E$${MAX_ROW})`,
    };
    cell.numFmt = PESO_FORMAT;
  });
  const catTotalRow = orderedCategories.length + 2;
  catSheet.getCell(`A${catTotalRow}`).value = "Total";
  catSheet.getCell(`A${catTotalRow}`).font = { bold: true };
  const catTotalCell = catSheet.getCell(`B${catTotalRow}`);
  catTotalCell.value = { formula: `SUM(B2:B${catTotalRow - 1})` };
  catTotalCell.numFmt = PESO_FORMAT;
  catTotalCell.font = { bold: true };
  if (orderedCategories.length > 0) {
    catSheet.addConditionalFormatting({
      ref: `B2:B${catTotalRow - 1}`,
      rules: [
        {
          type: "colorScale",
          cfvo: [{ type: "min" }, { type: "max" }],
          color: [{ argb: "FFF0FDF4" }, { argb: "FF166534" }],
          priority: 1,
        },
      ],
    });
  }

  return (await workbook.xlsx.writeBuffer()) as ExcelJS.Buffer;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}
