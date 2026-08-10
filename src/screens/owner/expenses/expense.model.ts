import type { ExpenseDto, ReimbursementState } from '../../../backend/modules/shared/expense.types';
import {
  categoryLabel,
  paymentMethodLabel,
  reimbursementState,
} from '../../../backend/modules/shared/expense.types';
import { formatCurrency } from '../../../utils/formatters';

/**
 * Turning an `ExpenseDto` into the strings a list card renders.
 *
 * RN-free so jest can cover it — nothing in `ExpensesScreen.tsx` is testable in this repo.
 */

export interface ExpenseRow {
  id: number;
  /** The card's headline. Never blank — a titleless expense still has to be findable. */
  title: string;
  /** "₹8,450" — trimmed of a trailing `.00`, see `formatAmount`. */
  amountText: string;
  /** "Maintenance & Repair" — the full enum label, never the shortened chip form. */
  categoryText: string;
  /** "Tata Power", or `''` when the expense names no vendor. */
  vendor: string;
  /** "05 Aug, 2:30 PM" — no year, matching the stock-ops cards. */
  whenText: string;
  /** "Net Banking" / "—". */
  paymentText: string;
  /** Which pill to draw, or none. Derived from two booleans — there is no status column. */
  reimbursement: ReimbursementState;
  /** Whether to draw the receipt glyph. `files` is absent on most rows, not empty. */
  hasReceipt: boolean;
  /** The record itself, for the actions sheet. */
  raw: ExpenseDto;
}

/**
 * "₹8,450" and "₹8,450.50".
 *
 * `formatCurrency` is the only Intl-free shared ₹ helper in the app, but it always writes two
 * decimals; the mockups draw whole rupees. Trimming a trailing `.00` keeps both true — an amount
 * with real paise still shows them. Same treatment `CatalogPickerSheet`'s local `money()` applies,
 * rather than a ninth `formatPrice` copy.
 */
export function formatAmount(amount: number | null | undefined): string {
  return formatCurrency(Number(amount ?? 0)).replace(/\.00$/, '');
}

/**
 * "05 Aug, 2:30 PM" — the card's timestamp.
 *
 * No year, because a list is overwhelmingly this month's spending and the year is noise until it
 * is not. The detail screen shows the full stamp.
 *
 * Meridiem built by hand rather than via `toLocaleTimeString`, which renders it lowercase on Chrome
 * and uppercase elsewhere — the same rule `batch.model` and `consumption.model` follow.
 *
 * ⚠️ `expenseDate` is an INSTANT (it carries `Z` or an offset), unlike consumption's zone-less
 * `consumedAt`. Parsing it with `new Date` is therefore safe and unambiguous; the display is then
 * the DEVICE's local rendering of that instant, which is what every other card in the app does.
 */
export function formatExpenseStamp(instant: string | null | undefined): string {
  const raw = String(instant ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hour12}:${minute} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The full stamp for the detail screen — "04 Aug 2026, 5:10 PM". */
export function formatExpenseStampLong(instant: string | null | undefined): string {
  const raw = String(instant ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const short = formatExpenseStamp(raw);
  if (!short) return '';
  // "05 Aug, 2:30 PM" → "05 Aug 2026, 2:30 PM": the year goes after the month, not on the end.
  return short.replace(',', ` ${d.getFullYear()},`);
}

/** "04 Aug 2026" — date only, for the detail app bar's subtitle. */
export function formatExpenseDay(instant: string | null | undefined): string {
  const long = formatExpenseStampLong(instant);
  return long ? long.split(',')[0] : '';
}

/**
 * A row's title.
 *
 * Falls back to the id rather than to a blank: an expense whose title somehow went missing still
 * has to be tappable and deletable, and an empty card looks like a rendering fault.
 */
export function expenseTitle(record: ExpenseDto): string {
  const title = String(record?.title ?? '').trim();
  return title || `Expense #${record?.id ?? ''}`.trim();
}

/**
 * Whether the card draws a receipt glyph.
 *
 * ⚠️ Absence of `files` is NOT the same as an empty list, but both mean "no glyph" here. Worth
 * stating because the DELETE response always returns `files: []` regardless of what was attached —
 * so nothing may infer "the receipts are gone" from a falsy answer to this.
 */
export function hasReceipt(record: ExpenseDto): boolean {
  return Array.isArray(record?.files) && record.files.length > 0;
}

export function toExpenseRow(record: ExpenseDto): ExpenseRow {
  return {
    id: Number(record?.id ?? 0),
    title: expenseTitle(record),
    amountText: formatAmount(record?.amount),
    categoryText: categoryLabel(record?.category),
    vendor: String(record?.vendorName ?? '').trim(),
    whenText: formatExpenseStamp(record?.expenseDate),
    paymentText: paymentMethodLabel(record?.paymentMethod),
    reimbursement: reimbursementState(record ?? {}),
    hasReceipt: hasReceipt(record),
    raw: record,
  };
}

/**
 * The card's second line — "Maintenance & Repair · SecureTech".
 *
 * The vendor half is dropped entirely when absent rather than rendered as a dash: a category on its
 * own is a complete statement, and "Rent / Lease · —" invites the reader to wonder what is missing.
 */
export function cardCategoryLine(row: Pick<ExpenseRow, 'categoryText' | 'vendor'>): string {
  return [row.categoryText, row.vendor].filter(Boolean).join(' · ');
}

/** The card's third line — "04 Aug · UPI". Either half may be missing. */
export function cardMetaLine(row: Pick<ExpenseRow, 'whenText' | 'paymentText'>): string {
  const payment = row.paymentText === '—' ? '' : row.paymentText;
  return [row.whenText, payment].filter(Boolean).join(' · ');
}
