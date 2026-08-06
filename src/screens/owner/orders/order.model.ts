/**
 * Row mapping and formatting for the Orders list, shared with the Order Detail screen.
 *
 * Every function here used to live inside `OrdersScreen.tsx`, where `jest.config.js` cannot reach
 * it — `testMatch` is `*.test.ts`, so a helper in a `.tsx` is untestable by construction. That was
 * survivable while orders were a dead-end list; it stops being survivable the moment a second
 * screen needs the same row shape and the same money format, because then "the row and the record
 * agree" is a claim nobody can check.
 *
 * Mirrors `appointments/appointment.model.ts` and `billing/bill.model.ts`, which were written this
 * way from the start.
 */

import { formatCurrency, initialsOf } from '../../../utils/formatters';

// Re-exported so the list and the detail screen have one import surface, and so a card and a
// record can never disagree about how a customer's initials are drawn.
export { initialsOf };

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Every status an order can hold. No transition rules exist server-side — `updateOrderStatus`'s
 * own javadoc says "any status is reachable from any other" — so this is display order, not a
 * lifecycle.
 */
export const STATUS_ORDER = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

export type OrderStatusKey = (typeof STATUS_ORDER)[number];

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

/** Title Case for a known status, the raw value for anything the server invents later. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return STATUS_LABEL[status] ?? status;
}

/**
 * Per-ITEM status, which is a different and longer set than the order's own.
 *
 * DELIVERED / COMPLETED / CANCELLED / RETURNED are terminal server-side; the rest are in flight.
 */
export const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export function itemStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return ITEM_STATUS_LABEL[status] ?? status;
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

/**
 * One list row.
 *
 * The list endpoint returns raw backend DTOs, and the field names mirror the web portal rather than
 * anything shorter: `orderStatus` and `orderDate`, NOT `status` and `date`.
 */
export interface OrderRow {
  id: number;
  customerName: string;
  orderNumber: string;
  amount: number;
  status: string;
  when: string | null;
  phone?: string;
  email?: string;
}

/** Loose: the DTO carries far more than a row needs, and that is the point. */
export interface RawOrder {
  id?: unknown;
  [k: string]: unknown;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/**
 * "Anjali Rao" from whichever of the four name-ish fields the response carries.
 *
 * Four, because three different producers feed this: the enriched DTO splits the person into
 * `customerFirstName`/`customerLastName`, some list rows carry a flattened `customerName`, and the
 * web portal's own row objects add `customer`. Falling through them in order is cheaper than
 * teaching every producer to agree.
 */
export function customerNameOf(raw: RawOrder | null | undefined): string {
  if (!raw) return 'Unknown Customer';
  const first = str(raw.customerFirstName).trim();
  const last = str(raw.customerLastName).trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return str(raw.customerName).trim() || str(raw.customer).trim() || 'Unknown Customer';
}

export function toOrderRow(raw: RawOrder | null | undefined, index: number): OrderRow {
  const id = Number(raw?.id ?? index);
  return {
    id,
    customerName: customerNameOf(raw),
    // The number is NOT NULL server-side (V108), so the `#id` fallback is for a row this client
    // built locally before saving, not for anything the backend can return.
    orderNumber: str(raw?.orderNumber) || `#${id}`,
    amount: Number(raw?.totalAmount ?? 0),
    status: str(raw?.orderStatus) || 'PENDING',
    when: (raw?.orderDate as string) || (raw?.createdAt as string) || null,
    phone: str(raw?.customerPhoneNumber) || undefined,
    email: str(raw?.customerEmail) || undefined,
  };
}

// ─── Money ───────────────────────────────────────────────────────────────────

/**
 * Whole rupees per the mockups (₹2,450, not ₹2,450.00), but paise are kept when an order actually
 * carries them.
 *
 * Not `formatCurrency` directly: that promises two decimals and other callers rely on it.
 */
export function formatAmount(n: number): string {
  return formatCurrency(n).replace(/\.00$/, '');
}

// ─── Dates ───────────────────────────────────────────────────────────────────

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
] as const;

/**
 * "2:30 PM" — the time half of a card's meta line.
 *
 * `orderDate` is a real instant with an offset, unlike an appointment's zone-less wall clock, so
 * parsing it with `Date` is correct here and wrong there. See `appointment.model.ts:44`.
 */
export function timeOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = d.getMinutes();
  return `${h12}:${mm < 10 ? `0${mm}` : mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Calendar-day key (local) used to bucket rows into sections. */
export function dayKeyOf(iso: string | null): string {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'undated';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Section title: "TODAY · 22 APR", "YESTERDAY · 21 APR", else "22 APR".
 *
 * `now` is injectable so the relative labels can be tested without freezing the clock.
 */
export function dayLabelOf(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'UNDATED';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'UNDATED';
  const stamp = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return `TODAY · ${stamp}`;
  if (diff === -1) return `YESTERDAY · ${stamp}`;
  if (diff === 1) return `TOMORROW · ${stamp}`;
  return stamp;
}

/** "5 Aug 2026" — the detail screen's title-block date, next to the status pill. */
export function formatOrderDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const month = MONTHS[d.getMonth()];
  return `${d.getDate()} ${month.charAt(0)}${month.slice(1).toLowerCase()} ${d.getFullYear()}`;
}

/** "5 Aug 2026, 2:14 PM" — System Information rows. */
export function formatOrderStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = formatOrderDate(iso);
  if (!date) return '';
  const time = timeOf(iso);
  return time ? `${date}, ${time}` : date;
}
