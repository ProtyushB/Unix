/**
 * Pure row mapping and formatting for the Appointments screen.
 *
 * No React Native imports on purpose — the repo's jest config is plain node with
 * `testMatch: '<rootDir>/src/**\/*.test.ts'` and no RN preset, so anything worth testing has to
 * live in a `.ts` module like this one. Same split the updater's `evaluateManifest` uses.
 */

import { NO_CUSTOMER } from '../../../utils/formatters';

export type AppointmentStatusKey =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AppointmentRow {
  id: number;
  appointmentNumber: string;
  customerName: string;
  /** "YYYY-MM-DD", server-rendered in IST. Also the key into the day-counts map. */
  date: string;
  /** "HH:mm" 24h, server-rendered in IST. */
  time: string;
  amount: number;
  status: string;
  serviceName: string;
  itemCount: number;
  phone?: string;
  email?: string;
  isBilled: boolean;
}

/** Display labels. "Scheduled" from the mockup was a slip — PENDING is the real status. */
export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

/**
 * "14:30" → "2:30 PM". Pure string maths on the server's `appointmentTime`.
 *
 * Deliberately NOT `new Date(appointmentDateTime).getHours()`, the way OrdersScreen does it.
 * `appointmentDateTime` is a zone-less IST wall clock, so JS parses it as device-local — right by
 * accident on an IST phone, wrong in the web preview and for anyone travelling. `appointmentTime`
 * is already the IST wall clock the user booked, so formatting it needs no timezone at all.
 */
export function formatApptTime(hhmm?: string | null): string {
  if (!hhmm) return '';
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  // 0 → 12 AM and 12 → 12 PM; % 12 alone gives a nonsense "0".
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mRaw ?? '00'} ${suffix}`;
}

/** Just the "AM"/"PM" half, for the stacked time gutter in the mockup. */
export function apptMeridiem(hhmm?: string | null): string {
  const formatted = formatApptTime(hhmm);
  return formatted ? formatted.slice(-2) : '';
}

/** Just the "2:30" half. */
export function apptClock(hhmm?: string | null): string {
  const formatted = formatApptTime(hhmm);
  return formatted ? formatted.slice(0, -3) : '';
}

function pick(raw: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
  }
  return undefined;
}

/** Maps one API appointment onto the row shape the list renders. */
export function toAppointmentRow(raw: Record<string, any>): AppointmentRow {
  const first = pick(raw, 'customerFirstName') ?? '';
  const last = pick(raw, 'customerLastName') ?? '';
  const name = `${first} ${last}`.trim();

  const items: any[] = Array.isArray(raw.appointmentItemsWithDetails)
    ? raw.appointmentItemsWithDetails
    : Array.isArray(raw.appointmentItems)
      ? raw.appointmentItems
      : [];

  const firstServiceName = pick(items[0] ?? {}, 'serviceName', 'packageName') ?? 'Service';

  return {
    id: Number(raw.id),
    appointmentNumber: String(pick(raw, 'appointmentNumber') ?? `#${raw.id}`),
    // See order.model.ts — one em dash across all three record types.
    customerName: name || NO_CUSTOMER,
    // Both taken from the server's pre-split IST fields — never parsed out of appointmentDateTime.
    date: String(pick(raw, 'appointmentDate') ?? ''),
    time: String(pick(raw, 'appointmentTime') ?? ''),
    amount: Number(raw.totalAmount ?? 0) || 0,
    // CONFIRMED, not PENDING: that is the entity's @PrePersist default, so a row with no status is
    // far more likely to be a confirmed booking than a pending one.
    status: String(pick(raw, 'appointmentStatus') ?? 'CONFIRMED'),
    serviceName: String(firstServiceName),
    itemCount: items.length,
    phone: pick(raw, 'customerPhoneNumber', 'customerPhone'),
    email: pick(raw, 'customerEmail'),
    isBilled: Boolean(raw.isBilled),
  };
}

/** "Haircut" or "Haircut +2" when the appointment has more than one item. */
export function serviceSummary(row: AppointmentRow): string {
  return row.itemCount > 1 ? `${row.serviceName} +${row.itemCount - 1}` : row.serviceName;
}

/** Whole rupees, paise kept only when they exist. Mirrors OrdersScreen's local helper. */
export function formatAmount(value: number): string {
  const whole = Number.isInteger(value);
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
