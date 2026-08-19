/**
 * Appointment service lines: reading them off the DTO, and editing them.
 *
 * Much smaller than the order screen's `orderLineUnits` — a service has a quantity and nothing
 * else, no sale-unit ladder — but it carries a trap of its own that the order side does not:
 * `StandaloneServiceItem.id` is a UUID the SERVER generates, and the per-item complete endpoint
 * matches on it. Drop it on a round trip and "Mark completed" silently stops working for that
 * line, because the fallback is a legacy match on `serviceId` that only fires for rows old enough
 * to have no id at all.
 */

/**
 * One editable service on the appointment. Loose beyond these keys: the DTO also carries
 * `serviceSnapshot`, `addedDuringExecution` and `addedAt`, none of which the form touches and all
 * of which must survive a save.
 */
export interface ServiceLine {
  /** The server's UUID for this item. Absent on a line the form has just created. */
  id?: string;
  serviceId: number;
  servicePersonId?: number | null;
  quantity: number;
  /** Null on any row the portal wrote — see {@link unitPrice}. */
  itemPrice: number | null;
  totalPrice: number;
  discount: number;
  status?: string;
  [k: string]: unknown;
}

interface RawItem {
  type?: unknown;
  serviceId?: unknown;
  [k: string]: unknown;
}

function isServiceItem(row: RawItem | null | undefined): boolean {
  if (!row) return false;
  const type = String(row.type ?? '').toUpperCase();
  // `defaultImpl` is StandaloneServiceItem, so an untyped row IS a service row — same reasoning as
  // the order side, where reading only the explicit discriminator drops rows the portal wrote.
  return type === '' || type === 'SERVICE';
}

/** The editable service rows. PACKAGE rows are separated out by `passthroughItems`. */
export function displayServices(item: { appointmentItems?: unknown } | null): ServiceLine[] {
  const raw = Array.isArray(item?.appointmentItems) ? (item?.appointmentItems as RawItem[]) : [];
  return raw.filter(isServiceItem) as unknown as ServiceLine[];
}

/**
 * The rows the form cannot edit, kept so they can be written straight back.
 *
 * An `AppointmentPackageItem` is a booking against slots someone already paid for; its
 * `fulfillments[]` carry the `linkedTransactionId` that ties them to this appointment. Dropping
 * one on a save would release those slots.
 */
export function passthroughItems(
  item: { appointmentItems?: unknown } | null,
): Record<string, unknown>[] {
  const raw = Array.isArray(item?.appointmentItems) ? (item?.appointmentItems as RawItem[]) : [];
  return raw.filter((row) => !isServiceItem(row)) as Record<string, unknown>[];
}

/**
 * A new line for a service the user just picked.
 *
 * No `id`: the server mints the UUID. Sending one the client invented would either be rejected or,
 * worse, accepted and then never match anything.
 */
export function newServiceLine(
  serviceId: number,
  price: number,
  servicePersonId: number | null,
): ServiceLine {
  return {
    serviceId,
    servicePersonId,
    quantity: 1,
    itemPrice: price,
    totalPrice: price,
    discount: 0,
    status: 'PENDING',
  };
}

/**
 * What one of this service costs.
 *
 * `itemPrice` is authoritative when the row has one, but a row the portal wrote does not: its
 * appointment payload sends `totalPrice` per line and no unit price at all, so the field comes back
 * null. The portal never notices because it derives the unit the same way on read. This screen took
 * `itemPrice ?? 0` at face value, so bumping the quantity on a portal-booked appointment priced the
 * service at nothing — and, since the grand total is the sum of the lines, the appointment with it.
 *
 * Orders are not exposed to this: their payload does send a unit price.
 */
export function unitPrice(line: ServiceLine): number {
  const stored = Number(line.itemPrice);
  if (line.itemPrice != null && Number.isFinite(stored)) return stored;
  const qty = Number(line.quantity ?? 0);
  return qty > 0 ? Number(line.totalPrice ?? 0) / qty : 0;
}

/**
 * Set a line's quantity, keeping its total in step. Never below one.
 *
 * Writes the unit price back so a portal-written row stops being ambiguous once it has been edited
 * here, instead of being re-derived on every later change.
 */
export function setQuantity(line: ServiceLine, quantity: number): ServiceLine {
  const qty = Math.max(1, Math.trunc(quantity) || 1);
  const price = unitPrice(line);
  return { ...line, quantity: qty, itemPrice: price, totalPrice: qty * price };
}

/**
 * Can this line be marked completed?
 *
 * Two conditions, both from the server: the item must be PENDING (`AppointmentServiceCard` gates
 * on it, and a completed item completing again is a no-op), and it must have an `id` — an item the
 * form created and has not saved yet has no UUID for the endpoint to match.
 */
export function canCompleteItem(line: ServiceLine): boolean {
  return String(line.status ?? 'PENDING').toUpperCase() === 'PENDING' && Boolean(line.id);
}

/** Terminal appointment statuses hide per-item completion entirely. */
export function canCompleteItems(appointmentStatus: string): boolean {
  return !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(appointmentStatus.toUpperCase());
}

/** "75 min · Qty 1" — the meta line under a service's name in read mode. */
export function serviceMeta(line: ServiceLine, duration: number | null): string {
  const parts: string[] = [];
  if (duration && duration > 0) parts.push(`${duration} min`);
  parts.push(`Qty ${line.quantity}`);
  return parts.join(' · ');
}
