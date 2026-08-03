/**
 * Row mapping and formatting for the Billing screen, kept RN-free so the repo's plain-node jest can
 * cover it — same reason `appointment.model.ts` exists.
 *
 * A bill carries TWO independent status axes. `billStatus` is the document's lifecycle
 * (Draft → Finalized → Cancelled) and `paymentStatus` is the money (Unpaid / Paid / Partial /
 * Failed / refunds). Every row shows both pills because either can be the interesting one: a
 * finalized bill nobody has paid is a debt, a draft that is somehow paid is a mistake.
 */

export interface BillRow {
  id: number;
  billNumber: string;
  customerName: string;
  /** YYYY-MM-DD in IST, taken from the server's rendered date — never parsed from an instant. */
  date: string;
  amount: number;
  billStatus: string;
  paymentStatus: string;
  /** grandTotal − paid − refunded, floored at 0. Only meaningful while something is still owed. */
  balance: number;
}

/** Server bill shape, loose because the DTO carries far more than a row needs. */
interface RawBill {
  id?: number;
  billNumber?: string;
  customerName?: string;
  billDate?: string;
  createdAt?: string;
  grandTotal?: number | string;
  paidAmount?: number | string;
  refundedAmount?: number | string;
  billStatus?: string;
  paymentStatus?: string;
  [k: string]: unknown;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The IST calendar day of an instant, as YYYY-MM-DD.
 *
 * `billDate` is a real instant with an offset (unlike an appointment's zone-less wall clock), so it
 * must be converted rather than string-sliced — slicing the ISO string yields the UTC day, which is
 * the previous day for anything before 05:30 IST.
 */
export function billDayKey(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA renders as YYYY-MM-DD, which is exactly the key format and needs no reassembly.
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Today's date in IST, as YYYY-MM-DD.
 *
 * Deliberately routed through {@link billDayKey} rather than reimplemented, so "which day is this
 * bill on" and "which day is it now" cannot answer in different timezones. Comparing an IST row
 * date against a DEVICE-local today is the bug this exists to prevent: on a device that is not on
 * IST — the web preview, or a travelling owner — a bill correctly filed under the 23rd would be
 * compared against a today of the 22nd and render "23 APR" instead of "TODAY".
 *
 * `now` is injectable so the tests can pin an instant instead of depending on the clock, and so
 * the screen can hand in a fresh value rather than freezing this at mount — see the note there
 * about a screen left open past midnight.
 */
export function istToday(now: Date = new Date()): string {
  return billDayKey(now.toISOString());
}

export function toBillRow(raw: RawBill): BillRow {
  const total = num(raw.grandTotal);
  const paid = num(raw.paidAmount);
  const refunded = num(raw.refundedAmount);
  const owed = total - paid - refunded;

  return {
    id: num(raw.id),
    billNumber: raw.billNumber ?? '',
    // A walk-in with no linked Person has no name; the row still has to render something.
    customerName: raw.customerName?.trim() || 'Walk-in',
    date: billDayKey(raw.billDate ?? raw.createdAt),
    amount: total,
    // The server defaults these on create, but a legacy row can carry null.
    billStatus: raw.billStatus ?? 'DRAFT',
    paymentStatus: raw.paymentStatus ?? 'UNPAID',
    balance: owed > 0 ? owed : 0,
  };
}

/** Pill copy. The raw enum names are shouty and PARTIALLY_PAID does not fit a pill. */
export const BILL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partial',
  REFUNDED: 'Refunded',
  PARTIAL_REFUNDED: 'Part refund',
  FAILED: 'Failed',
};

/** "₹2,450" — whole rupees, Indian digit grouping. Matches the mockup's row amounts. */
export function formatAmount(v: number): string {
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

/**
 * "₹18.7K" — the compact form used by the header line and the wallet card.
 *
 * The header has to fit a count and a money figure on one line under the title, and the wallet
 * card shows three figures side by side; full grouping overflows both. Lakh rather than a jump
 * straight to millions, since these are rupee amounts read by Indian users.
 */
export function formatCompactAmount(v: number): string {
  const n = Math.abs(v);
  if (n >= 10000000) return '₹' + (v / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (n >= 100000) return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

/**
 * The header subtitle: "41 bills · ₹18.7K outstanding".
 *
 * Drops the outstanding clause entirely at zero rather than printing "₹0 outstanding" — a business
 * that is fully settled should read as having nothing to chase, not as having a zero balance.
 */
export function billsHeaderLine(totalBills: number, totalOutstanding: number): string {
  const bills = `${totalBills} bill${totalBills === 1 ? '' : 's'}`;
  if (totalOutstanding <= 0) return bills;
  return `${bills} · ${formatCompactAmount(totalOutstanding)} outstanding`;
}

/**
 * Section heading for a day group: "TODAY", "YESTERDAY", or "22 APR".
 *
 * `today` is injected rather than read from the clock so the grouping is testable and so a screen
 * left open past midnight can be handed a fresh value instead of silently mislabelling.
 */
export function billSectionTitle(dayKey: string, today: string): string {
  if (!dayKey) return '';
  if (dayKey === today) return 'TODAY';
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
    yesterday.getDate(),
  ).padStart(2, '0')}`;
  if (dayKey === yKey) return 'YESTERDAY';

  const MONTHS = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const [, mm, dd] = dayKey.split('-');
  return `${Number(dd)} ${MONTHS[Number(mm) - 1]}`;
}

/** Group rows into day sections, preserving the server's ordering within and between groups. */
export function groupBillsByDay(
  rows: BillRow[],
  today: string,
): { title: string; data: BillRow[] }[] {
  const out: { title: string; data: BillRow[] }[] = [];
  for (const row of rows) {
    const title = billSectionTitle(row.date, today);
    const last = out[out.length - 1];
    // Append to the open group rather than bucketing by key: the list is server-sorted, so equal
    // days are already adjacent, and this keeps that order instead of re-deriving one.
    if (last && last.title === title) last.data.push(row);
    else out.push({ title, data: [row] });
  }
  return out;
}
