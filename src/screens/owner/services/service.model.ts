/**
 * Row mapping and formatting for the Services screen, kept RN-free so the repo's plain-node jest
 * can cover it — same reason `product.model.ts` and `bill.model.ts` exist.
 *
 * The contrast worth holding in mind is with products. A product has no status at all, and its
 * "Tracked / Low stock / Out of stock" badge is derived from inventory sums. A service is the
 * opposite: it owns a real stored `availability` boolean that the owner sets by hand, and there is
 * no inventory behind it. So the badge here is a straight read of one column, not a computation.
 */

export interface ServiceRow {
  id: number;
  name: string;
  /** Row subtitle. Blank rather than a placeholder — plenty of services have no description. */
  description: string;
  price: number;
  /** Minutes. Null when unset — the server stores null rather than 0 for "not specified". */
  duration: number | null;
  /** Stored and owner-set, unlike a product's derived stock state. */
  availability: boolean;
}

/** Server service shape, loose because the DTO carries far more than a row needs. */
interface RawService {
  id?: number;
  name?: string;
  description?: string;
  price?: number | string;
  duration?: number | string | null;
  availability?: boolean;
  [k: string]: unknown;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export function toServiceRow(raw: RawService): ServiceRow {
  const d = raw.duration;
  return {
    id: num(raw.id),
    name: raw.name?.trim() || 'Untitled service',
    // Collapsed to one line: a description is up to 1000 characters server-side, and the row gives
    // it one. Newlines would silently blow the row height out.
    description: (raw.description ?? '').replace(/\s+/g, ' ').trim(),
    price: num(raw.price),
    // Null is preserved. The form treats 0 and blank alike and sends null, so a 0 here would mean
    // "zero minutes", which nothing intends.
    duration: d === null || d === undefined || d === '' ? null : num(d),
    // The column is NOT NULL DEFAULT true; a legacy row arriving without it is available.
    availability: raw.availability !== false,
  };
}

// ─── Availability ────────────────────────────────────────────────────────────

export type AvailabilityState = 'AVAILABLE' | 'UNAVAILABLE';

export function availabilityStateFor(row: ServiceRow): AvailabilityState {
  return row.availability ? 'AVAILABLE' : 'UNAVAILABLE';
}

export const AVAILABILITY_LABEL: Record<AvailabilityState, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
};

export const AVAILABILITY_TINT: Record<AvailabilityState, 'success' | 'error'> = {
  AVAILABLE: 'success',
  UNAVAILABLE: 'error',
};

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * "180 min", or '' when the service has no duration set.
 *
 * Bare minutes with no hour rollover, matching both the mockups and the three places the app
 * already inlines this. It lives behind a function anyway so switching to "3h" is one edit rather
 * than a hunt — and so the null case is handled once instead of at every call site.
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '';
  return `${minutes} min`;
}

/** "₹1,500" — whole rupees, Indian digit grouping. Matches the mockup's row prices. */
export function formatPrice(v: number): string {
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

/**
 * The panel subtitle: "30 services".
 *
 * The mockup reads "30 services · 6 categories", but the category clause is dropped: the mappers
 * leave `categorySet` null, so a service arrives with category IDs and no names, and a count of
 * things nobody can see named is noise.
 */
export function servicesHeaderLine(totalItems: number): string {
  return `${totalItems} service${totalItems === 1 ? '' : 's'}`;
}

/** "3 results for 'Facial'" — the search-mode replacement for the line above. */
export function servicesResultLine(count: number, query: string): string {
  return `${count} result${count === 1 ? '' : 's'} for '${query}'`;
}

/**
 * A stable 0-based index into an icon or colour pool, from the service name.
 *
 * The mockup gives every service a semantic glyph — scissors for threading, a droplet for a hair
 * spa. Nothing in the data supports that: categories would be the only signal and they arrive
 * without names. Hashing the name keeps a service's glyph stable across refetches and varied down
 * the list, which is what the thumbnails actually communicate at a glance.
 */
export function serviceTintIndex(name: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % poolSize;
}
