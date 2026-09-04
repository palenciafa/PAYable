import { z } from "zod";

// Money enters validation as a decimal peso number from the UI and is
// converted to integer cents immediately, so no float ever reaches the
// database.
const pesoAmount = z
  .number()
  .finite()
  .positive("Amount must be greater than zero");

export const splitModeSchema = z.enum(["50-50", "custom", "percentage"]);

export const transactionInputSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(200),
    categoryId: z.string().uuid("Choose a category"),
    totalAmount: pesoAmount,
    paidBy: z.string().uuid("Choose who paid"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    notes: z.string().max(1000).optional().nullable(),
    splitMode: splitModeSchema,
    // For custom: decimal peso amounts per user. For percentage: 0-100
    // per user. For 50-50 this is ignored; the server computes it.
    splits: z.record(z.string().uuid(), z.number().finite()).optional(),
  })
  .refine(
    (data) => data.splitMode === "50-50" || (data.splits && Object.keys(data.splits).length === 2),
    { message: "Provide a share for both people", path: ["splits"] }
  );

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const paymentInputSchema = z.object({
  fromUser: z.string().uuid("Choose who paid"),
  toUser: z.string().uuid("Choose who received it"),
  amount: pesoAmount,
  paymentMethod: z.enum(["Cash", "GCash", "Bank Transfer", "Other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  notes: z.string().max(1000).optional().nullable(),
}).refine((d) => d.fromUser !== d.toUser, {
  message: "Payer and recipient must be different people",
  path: ["toUser"],
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const emailOtpRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  name: z.string().trim().min(1, "Enter your name").max(60).optional(),
});

export const emailOtpVerifySchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  name: z.string().trim().min(1).max(60).optional(),
});
