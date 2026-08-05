/**
 * Form mapping and the payload builder for the Bill Detail screen.
 *
 * The most dangerous builder in the app, and the reason is worth stating plainly: `PUT
 * /{module}Bill/{billId}` is not merely a full-object replace like its order and appointment
 * cousins — omissions have SIDE EFFECTS BEYOND THE RECORD.
 *
 *   omit `billedOrders`      → every linked order is released (isBilled=false, billId=null)
 *   omit `billedAppointments`→ same for appointments
 *   omit `customProducts`    → the bare lines are deleted AND their inventory is RESTOCKED
 *   omit `customServices`    → same
 *   omit `notes`             → erased
 *   omit `tips`              → forced to zero
 *   omit `discount`          → set to null
 *   omit `taxRate`           → zeroed, and taxAmount with it
 *
 * None of those is an error. The save returns 200 and the damage is silent. So this builder never
 * assembles from form state alone — it rebuilds every one of those fields on every write, and
 * `billLines.ts` owns the read→write shape change that makes it possible.
 *
 * The other half of the contract is what must NOT be sent: `subtotal`, `discountAmount`,
 * `taxAmount` and `grandTotal` are recomputed server-side and `CreateBillRequest` has no field for
 * any of them.
 */

import { attachedIds, bareToWrite, toBillLines, type BillLine } from './billLines';
import {
  computeBillMoney,
  readDiscount,
  settlementField,
  writeDiscount,
  type BillMoney,
  type Discount,
} from './billMoney';

export { formatAmount, BILL_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '../bill.model';
export { initialsOf } from '../../../../utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillDetailItem {
  id?: number | null;
  businessId?: number | null;
  [k: string]: unknown;
}

export interface BillFormState {
  billStatus: string;
  paymentStatus: string;
  /** Preserved rather than edited — there is no mobile EMI UI, and blanking it rewrites the bill. */
  paymentOption: string;
  /** "YYYY-MM-DD". */
  billDate: string;
  notes: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  lines: BillLine[];
  tips: number;
  discount: Discount;
  taxRate: number;
  paidAmount: number;
  refundedAmount: number;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toId(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** "YYYY-MM-DD" in IST. `billDate` IS a real instant with an offset, unlike an appointment's. */
export function billDateOf(item: BillDetailItem | null): string {
  const raw = str(item?.billDate);
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd && !raw.includes('T')) return ymd[1];
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  // Never slice the ISO string: that yields the UTC day, i.e. the previous one before 05:30 IST.
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── DTO → form ──────────────────────────────────────────────────────────────

export function toFormState(item: BillDetailItem | null): BillFormState {
  const first = str(item?.customerFirstName).trim();
  const last = str(item?.customerLastName).trim();
  return {
    billStatus: str(item?.billStatus) || 'DRAFT',
    paymentStatus: str(item?.paymentStatus) || 'UNPAID',
    // NORMAL unless the bill already says otherwise. Preserved so an existing EMI bill is not
    // silently rewritten by a phone that has no EMI screen.
    paymentOption: str(item?.paymentOption) || 'NORMAL',
    billDate: billDateOf(item),
    notes: str(item?.notes),
    customerId: toId(item?.customerId),
    customerName: [first, last].filter(Boolean).join(' ') || str(item?.customerName),
    customerPhone: str(item?.customerPhone) || str(item?.customerPhoneNumber),
    customerEmail: str(item?.customerEmail),
    lines: toBillLines(item as Record<string, unknown> | null),
    tips: num(item?.tips),
    discount: readDiscount(item?.discount),
    // 18 is the drawn default for a NEW bill only — an existing bill's stored 0 must stay 0.
    taxRate: item ? num(item?.taxRate) : 18,
    paidAmount: num(item?.paidAmount),
    refundedAmount: num(item?.refundedAmount),
  };
}

/** The bill's money, computed for display. See `billMoney` for why none of it is sent. */
export function money(form: BillFormState): BillMoney {
  const subtotal = form.lines.reduce((sum, line) => sum + num(line.amount), 0);
  return computeBillMoney({
    subtotal,
    tips: form.tips,
    discount: form.discount,
    taxRate: form.taxRate,
  });
}

// ─── Form → payload ──────────────────────────────────────────────────────────

/**
 * Build the body for `POST /{module}Bill` and `PUT /{module}Bill/{billId}`.
 *
 * The same shape serves both — `CreateBillRequest` is the write type for each — which is itself a
 * reason the update is so destructive: the request cannot express "leave this alone", only "here
 * is the whole bill".
 *
 * Every erasable field is written unconditionally, including the ones the form never edits:
 * `billedOrders` and `billedAppointments` come from the lines still on screen, and
 * `customProducts` / `customServices` are rebuilt from the bare rows by `billLines`.
 *
 * `undefined` is meaningful. A key set to `undefined` is dropped by `JSON.stringify`, and the
 * server reads a missing `discount` as "clear it" — which is exactly right for a discount the user
 * removed, and exactly wrong for anything that must survive. Only `discount` and the settlement
 * amounts use it.
 */
export function buildBillPayload(form: BillFormState, businessId: number): Record<string, unknown> {
  const { customProducts, customServices } = bareToWrite(form.lines);
  const settlement = settlementField(form.paymentStatus);

  return {
    // @NotNull / @NotBlank — the only three the server refuses cleanly, with a 400.
    customerId: form.customerId,
    customerPhone: form.customerPhone.trim(),
    businessId,

    // Always sent. Omitting either RELEASES the linked records rather than leaving them be.
    billedOrders: attachedIds(form.lines, 'ORDER'),
    billedAppointments: attachedIds(form.lines, 'APPOINTMENT'),

    // Always sent. Omitting either deletes the bare lines AND restocks their inventory.
    customProducts,
    customServices,

    // Money INPUTS only. subtotal / discountAmount / taxAmount / grandTotal are server-computed and
    // have no field on the request — sending them would be ignored at best.
    tips: Math.max(0, form.tips),
    discount: writeDiscount(form.discount),
    taxRate: Math.min(Math.max(0, form.taxRate), 100),

    // Copied unguarded server-side, so an omission erases the stored note.
    notes: form.notes.trim(),

    billStatus: form.billStatus,
    paymentStatus: form.paymentStatus,
    // No mobile EMI UI; echoed so an EMI bill is not quietly converted to NORMAL.
    paymentOption: form.paymentOption || 'NORMAL',

    /**
     * Only the two PARTIAL states carry an amount. Every other status has its settlement forced by
     * `applySettlementAmounts` — on PAID the server sets paidAmount to grandTotal whatever the
     * client sent — so sending one would be noise, and NOT sending one on a PARTIAL is a 400.
     */
    ...(settlement === 'paidAmount' ? { paidAmount: form.paidAmount } : {}),
    ...(settlement === 'refundedAmount' ? { refundedAmount: form.refundedAmount } : {}),
  };
}

// ─── Read-mode helpers ───────────────────────────────────────────────────────

export function itemCountLabel(lines: BillLine[]): string {
  return `${lines.length} item${lines.length === 1 ? '' : 's'}`;
}

/** How many attached records there are — the number that decides whether the customer is locked. */
export function attachedCount(lines: BillLine[]): number {
  return lines.filter((l) => l.kind === 'ORDER' || l.kind === 'APPOINTMENT').length;
}

/** "5 Aug 2026" from the YYYY-MM-DD the form holds. Built from parts, never re-parsed. */
export function formatBillDate(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`;
}

/** "5 Aug 2026, 6:40 PM" — System Information. These ARE instants. */
export function formatStamp(iso: unknown): string {
  const raw = str(iso);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const h24 = parsed.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = parsed.getMinutes();
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}, ${h12}:${
    mm < 10 ? `0${mm}` : mm
  } ${h24 < 12 ? 'AM' : 'PM'}`;
}
