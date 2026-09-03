import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Convert a decimal peso amount (e.g. from a text input) to integer cents. */
export function pesosToCents(pesos: number | string): number {
  const n = typeof pesos === "string" ? parseFloat(pesos) : pesos;
  if (!Number.isFinite(n)) return 0;
  // Round to avoid binary float artifacts like 250.00000000000003
  return Math.round(n * 100);
}

/** Convert integer cents to a decimal peso number. */
export function centsToPesos(cents: number): number {
  return cents / 100;
}

/** Format integer cents as a Philippine Peso string, e.g. ₱1,250.00 */
export function formatCurrency(cents: number): string {
  const pesos = centsToPesos(cents);
  const sign = pesos < 0 ? "-" : "";
  const formatted = Math.abs(pesos).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₱${formatted}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthLabel(yyyyMm: string): string {
  const parts = yyyyMm.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long" });
}
