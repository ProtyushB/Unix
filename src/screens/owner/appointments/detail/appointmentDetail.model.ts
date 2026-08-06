/**
 * Form mapping and the payload builders for the Appointment Detail screen.
 *
 * RN-free so jest reaches it. Same job as `orderDetail.model.ts`, and mostly the same shape — but
 * the hazards are different enough that copying the order builder across would break three things
 * at once:
 *
 *  1. `appointmentStatus` has NO fallback. `OrderMapper` defaults a null status to CONFIRMED;
 *     `AppointmentMapper` maps null to null, and the column is NOT NULL. Omitting it is an
 *     HTTP 500, not a silent reset.
 *  2. `appointmentDateTime` is a ZONE-LESS IST wall clock (`2026-08-05T10:00:00`). An ISO instant
 *     with a `Z` throws `DateTimeParseException` server-side.
 *  3. The items are NULL-GUARDED, unlike an order's. Omitting them preserves the stored list;
 *     sending `[]` erases it. That inverts the order rule, where omitting is the destructive one.
 */

import { displayServices, type ServiceLine } from './appointmentLines';

// Re-exported so the detail screen has one import surface, and so a row and a record can never
// disagree about how a time, an amount or a status reads.
export { formatAmount, formatApptTime, STATUS_LABEL } from '../appointment.model';
export { initialsOf } from '../../../../utils/formatters';

import { formatApptTime, STATUS_LABEL } from '../appointment.model';

// ─── Status ──────────────────────────────────────────────────────────────────

/** Display order. No transition rules exist server-side — any status reaches any other. */
export const STATUS_ORDER = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return STATUS_LABEL[status] ?? status;
}

/** Per-service status. Only PENDING items can be completed; the rest are already resolved. */
export function itemStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return STATUS_LABEL[status] ?? status;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppointmentDetailItem {
  id?: number | null;
  businessId?: number | null;
  /**
   * Declared rather than left to the index signature, so this type is assignable to the
   * all-optional shapes `appointmentLines` takes. TypeScript's weak-type check rejects an object
   * with "no properties in common" with an all-optional target, and an index signature does not
   * count as one.
   */
  appointmentItems?: unknown;
  [k: string]: unknown;
}

export interface AppointmentFormState {
  appointmentStatus: string;
  notes: string;
  /** "YYYY-MM-DD" and "HH:mm", both IST wall clock. Recombined only at save time. */
  date: string;
  time: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  lines: ServiceLine[];
}

/**
 * Stripped before a write.
 *
 * `appointmentItemsWithDetails` is the important one. Its order-side twin is marked
 * `@JsonProperty(access = READ_ONLY)` and has a regression test proving an echo is harmless; this
 * one is NOT read-only, and `AppointmentItem` lacks the `@JsonIgnoreProperties(ignoreUnknown =
 * true)` that `OrderItem` carries. Echoing it would try to bind enrichment keys (`serviceName`,
 * `unitPrice`, `servicePersonName`) onto a `StandaloneServiceItem`. Boot's default tolerates
 * unknown properties so it probably survives, but "probably" is not a reason to send it.
 *
 * `appointmentDate` and `appointmentTime` are output-only projections of `appointmentDateTime`.
 */
export const DERIVED_KEYS = [
  'createdAt',
  'updatedAt',
  'completedAt',
  'billNumber',
  'appointmentDate',
  'appointmentTime',
  'appointmentItemsWithDetails',
  'appointedServiceItems',
] as const;

// ─── Primitives ──────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Date and time ───────────────────────────────────────────────────────────

/**
 * Split the stored wall clock into the two fields the form edits.
 *
 * String maths, never `new Date(...)`. `appointmentDateTime` carries no zone, so JS would parse it
 * as device-local — right by accident on an IST phone, wrong in the preview and wrong for anyone
 * travelling. `appointment.model.ts:44` records the same rule for the list.
 *
 * The DTO also returns `appointmentDate` and `appointmentTime` already split, and those are
 * preferred when present: they are the server's own IST rendering, so there is nothing to get
 * wrong.
 */
export function splitDateTime(item: AppointmentDetailItem | null): { date: string; time: string } {
  const date = str(item?.appointmentDate).trim();
  const time = str(item?.appointmentTime).trim();
  if (date || time) return { date, time: time.slice(0, 5) };

  const raw = str(item?.appointmentDateTime).trim();
  if (!raw) return { date: '', time: '' };
  const [datePart, timePart = ''] = raw.split('T');
  return { date: datePart, time: timePart.slice(0, 5) };
}

/**
 * Recombine into what the server wants: `YYYY-MM-DDTHH:mm:ss`, no zone, no offset, no `Z`.
 *
 * `AppointmentMapper.parseDateTime` uses `ISO_LOCAL_DATE_TIME` and interprets the result in
 * Asia/Kolkata. Anything carrying a zone throws; anything missing the seconds fails to parse.
 */
export function joinDateTime(date: string, time: string): string {
  const d = date.trim();
  const t = time.trim();
  if (!d || !t) return '';
  const withSeconds = t.length === 5 ? `${t}:00` : t;
  return `${d}T${withSeconds}`;
}

/** "5 Aug, 10:00 am" — the title block's line beside the status pill. */
export function formatWhen(date: string, time: string): string {
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
  const stamp = `${d} ${MONTHS[m - 1] ?? ''}`;
  const clock = formatApptTime(time);
  return clock ? `${stamp}, ${clock.toLowerCase()}` : stamp;
}

/** "5 Aug 2026" — System Information rows. Built from parts, never from `new Date(ymd)`. */
export function formatLongDate(date: string): string {
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

/** Instants — `createdAt` and friends ARE real instants with an offset, unlike the wall clock. */
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
  const clock = `${h12}:${mm < 10 ? `0${mm}` : mm} ${h24 < 12 ? 'AM' : 'PM'}`;
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}, ${clock}`;
}

// ─── DTO ⇄ form ──────────────────────────────────────────────────────────────

export function toFormState(item: AppointmentDetailItem | null): AppointmentFormState {
  const { date, time } = splitDateTime(item);
  const first = str(item?.customerFirstName).trim();
  const last = str(item?.customerLastName).trim();
  return {
    appointmentStatus: str(item?.appointmentStatus) || 'CONFIRMED',
    notes: str(item?.notes),
    date,
    time,
    customerId: toNumberOrNull(item?.customerId),
    customerName: [first, last].filter(Boolean).join(' ') || str(item?.customerName),
    customerPhone: str(item?.customerPhoneNumber),
    customerEmail: str(item?.customerEmail),
    lines: displayServices(item),
  };
}

export function linesTotal(lines: ServiceLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.totalPrice ?? 0), 0);
}

/** The whole appointment's total, including the package rows the form cannot edit. */
export function appointmentTotal(
  lines: ServiceLine[],
  passthrough: Record<string, unknown>[],
): number {
  const extra = passthrough.reduce((sum, row) => sum + Number(row?.totalPrice ?? 0), 0);
  return linesTotal(lines) + extra;
}

function editedFields(
  form: AppointmentFormState,
  passthrough: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    // NOT NULL with no server-side fallback — omit it and the save is a 500.
    appointmentStatus: form.appointmentStatus,
    appointmentDateTime: joinDateTime(form.date, form.time),
    notes: form.notes.trim(),
    customerId: form.customerId,
    totalAmount: appointmentTotal(form.lines, passthrough),
  };
}

/**
 * Build the body for `PUT /{module}Appointment`.
 *
 * Starts from the fetched DTO and overlays the edits. Three groups matter:
 *
 *  - `customerId`, `businessId`, `totalAmount`, `appointmentDateTime`, `appointmentStatus` are all
 *    NOT NULL and copied unguarded. Any one omitted is an HTTP 500.
 *  - `servicePlanId`, `sessionNumber` and `employmentId` are copied unguarded by
 *    `onUpdateModuleFields` and are **silently NULLed** when omitted. None has a mobile UI;
 *    `employmentId` is the assigned-staff field the web portal writes, and the inverse bug (not
 *    copying it) has already shipped once. They ride the `...serverItem` spread, which is exactly
 *    why the builder starts from the DTO rather than assembling from the form.
 *  - The items are null-guarded, so they are sent ONLY when there are some. See below.
 */
export function toUpdatePayload(
  serverItem: AppointmentDetailItem,
  form: AppointmentFormState,
  passthrough: Record<string, unknown>[],
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...serverItem };
  for (const key of DERIVED_KEYS) delete base[key];

  // Dropped from the base so that "omit the key" below actually omits it. Left in, the spread would
  // quietly re-send the STORED items under the form's edits — which looks like it works, right up
  // until someone removes a service and it comes back.
  delete base.appointmentItems;

  const items = [...form.lines, ...passthrough];

  return {
    ...base,
    ...editedFields(form, passthrough),
    id: serverItem.id,
    businessId: serverItem.businessId,
    /**
     * Sent only when non-empty, and the asymmetry with orders is deliberate.
     *
     * `reconcileIncomingItems` treats null as "not provided" and keeps the stored list, but treats
     * `[]` as an instruction — which erases a pure-standalone appointment's services. Validation
     * already refuses to save an appointment with no services, so an empty array here would only
     * ever be a bug; omitting the key makes that bug a no-op instead of data loss.
     */
    ...(items.length ? { appointmentItems: items } : {}),
  };
}

/**
 * Build the body for `POST /{module}Appointment`.
 *
 * `orderId` and `fulfillmentIds` are deliberately absent: `saveAppointmentWithPackages` rejects a
 * PARTIAL back-link (one without the other) with a 400, and the mobile screen books nothing
 * against a package.
 */
export function buildCreatePayload(
  form: AppointmentFormState,
  businessId: number,
): Record<string, unknown> {
  return {
    ...editedFields(form, []),
    businessId,
    appointmentItems: form.lines,
  };
}

// ─── Read-mode helpers ───────────────────────────────────────────────────────

export function serviceCountLabel(lines: ServiceLine[], passthrough: unknown[] = []): string {
  const n = lines.length + passthrough.length;
  return `${n} service${n === 1 ? '' : 's'}`;
}

export function billLine(item: AppointmentDetailItem | null): string {
  const number = str(item?.billNumber).trim();
  if (number) return `On bill ${number}`;
  return item?.billId != null ? 'On a bill' : 'Not on a bill yet';
}

export function isBilled(item: AppointmentDetailItem | null): boolean {
  return item?.isBilled === true;
}

/**
 * Names and durations for the lines, from the response the screen already has.
 *
 * Same trick as the order screen's `enrichedDisplay`: `appointmentItemsWithDetails` is the enriched
 * mirror the backend builds by joining each item to its service, so view mode needs no catalog.
 */
export function enrichedDisplay(
  item: AppointmentDetailItem | null,
): Record<number, { name: string; duration: number | null; unitPrice: number | null }> {
  const rows = Array.isArray(item?.appointmentItemsWithDetails)
    ? (item?.appointmentItemsWithDetails as Record<string, unknown>[])
    : [];
  const map: Record<number, { name: string; duration: number | null; unitPrice: number | null }> =
    {};
  for (const row of rows) {
    const id = Number(row?.serviceId);
    if (!Number.isFinite(id)) continue;
    map[id] = {
      name: str(row?.serviceName),
      duration: toNumberOrNull(row?.serviceDuration),
      unitPrice: toNumberOrNull(row?.unitPrice),
    };
  }
  return map;
}
