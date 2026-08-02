/**
 * Row mapping and formatting for the Products screen, kept RN-free so the repo's plain-node jest
 * can cover it — same reason `bill.model.ts` and `appointment.model.ts` exist.
 *
 * The central idea here is that **a product has no status field**. Nothing in Modulex carries one:
 * no `ProductStatus` enum, no active/inactive flag. What the mockup draws as Tracked / Low stock /
 * Out of stock is derived from two other things — whether the product opted into inventory
 * tracking, and how much sellable stock its batches currently hold.
 */

export interface ProductRow {
  id: number;
  name: string;
  /** Shown as the row's subtitle. Blank rather than a placeholder — plenty of products have none. */
  brand: string;
  price: number;
  /** "250 ml" — volume and unit joined, or '' when either is missing. */
  size: string;
  trackInventory: boolean;
  /**
   * Sellable stock, or null when there is no number to show: an untracked product, or ANY product
   * when the business has the Inventory tab switched off. Null is never the same as 0 — one means
   * "not counted", the other means "counted, and the shelf is empty".
   */
  availableQuantity: number | null;
  /** Server's own verdict. Kept because a CUSTOM combo can be available with a null quantity. */
  availability: boolean;
}

/** Server product shape, loose because the DTO carries far more than a row needs. */
interface RawProduct {
  id?: number;
  name?: string;
  brand?: string;
  price?: number | string;
  volume?: number | string | null;
  volumeUnit?: string | null;
  trackInventory?: boolean;
  availableQuantity?: number | null;
  availability?: boolean;
  [k: string]: unknown;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "250 ml". Both halves are optional on the entity, so a product with a volume but no unit renders
 * the bare number rather than "250 undefined".
 */
export function formatSize(volume: unknown, volumeUnit: unknown): string {
  const v = volume === null || volume === undefined || volume === '' ? null : num(volume);
  const unit = typeof volumeUnit === 'string' ? volumeUnit.trim() : '';
  if (v === null || v <= 0) return unit;
  return unit ? `${v} ${unit}` : String(v);
}

export function toProductRow(raw: RawProduct): ProductRow {
  const qty = raw.availableQuantity;
  return {
    id: num(raw.id),
    name: raw.name?.trim() || 'Untitled product',
    brand: raw.brand?.trim() || '',
    price: num(raw.price),
    size: formatSize(raw.volume, raw.volumeUnit),
    trackInventory: raw.trackInventory === true,
    // Preserve null. Coercing it to 0 here is precisely how a product that is merely untracked
    // ends up rendering "Out of stock".
    availableQuantity: qty === null || qty === undefined ? null : num(qty),
    availability: raw.availability !== false,
  };
}

// ─── Stock state ─────────────────────────────────────────────────────────────

export type StockState = 'TRACKED' | 'LOW' | 'OUT' | 'UNTRACKED';

/**
 * Which of the four stock states a row is in.
 *
 * `threshold` comes from the server alongside the list (`meta.lowStockThreshold`) rather than being
 * hardcoded here, so a row's badge and the header's "6 low on stock" are always decided by the same
 * number. Hardcoding a second copy is how the two drift apart.
 *
 * UNTRACKED is not in the mockup set — every product drawn there is tracked — but it is reachable
 * two ways: a product with tracking switched off, and every product when the Inventory tab is off.
 */
export function stockStateFor(row: ProductRow, threshold: number): StockState {
  if (!row.trackInventory || row.availableQuantity === null) return 'UNTRACKED';
  if (row.availableQuantity <= 0) return 'OUT';
  return row.availableQuantity <= threshold ? 'LOW' : 'TRACKED';
}

/** Badge copy in the list. The mockup's Search screen writes "Low Stock"; every other screen — and
 *  this — writes "Low stock". */
export const STOCK_BADGE_LABEL: Record<StockState, string> = {
  TRACKED: 'Tracked',
  LOW: 'Low stock',
  OUT: 'Out of stock',
  UNTRACKED: 'Available',
};

/** Badge copy in the grid, where a 149px card cannot fit the list's wording. */
export const STOCK_BADGE_LABEL_SHORT: Record<StockState, string> = {
  TRACKED: 'In stock',
  LOW: 'Low',
  OUT: 'Out',
  UNTRACKED: 'Available',
};

/** Palette role for the badge, shared by list and grid. */
export const STOCK_TINT: Record<StockState, 'success' | 'warning' | 'error' | 'muted'> = {
  TRACKED: 'success',
  LOW: 'warning',
  OUT: 'error',
  UNTRACKED: 'muted',
};

/**
 * The text beside the badge in the list — "48 in stock", "5 left", "Restock now".
 *
 * Out of stock says what to do rather than restating the badge; an untracked product says nothing
 * at all, because there is no number and "Available" has already been said by the badge.
 */
export function stockDetail(row: ProductRow, threshold: number): string {
  switch (stockStateFor(row, threshold)) {
    case 'TRACKED':
      return `${row.availableQuantity} in stock`;
    case 'LOW':
      return `${row.availableQuantity} left`;
    case 'OUT':
      return 'Restock now';
    default:
      return '';
  }
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** "₹420" — whole rupees, Indian digit grouping. Matches the mockup's row prices. */
export function formatPrice(v: number): string {
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

/**
 * The panel subtitle: "142 items · 6 low on stock".
 *
 * Drops the low-stock clause at zero rather than printing "0 low on stock" — a catalog with nothing
 * running down should read as having nothing to act on, not as scoring zero.
 */
export function productsHeaderLine(totalItems: number, lowStockCount: number): string {
  const items = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  if (lowStockCount <= 0) return items;
  return `${items} · ${lowStockCount} low on stock`;
}

/** "3 results for 'shampoo'" — the search-mode replacement for the line above. */
export function productsResultLine(count: number, query: string): string {
  return `${count} result${count === 1 ? '' : 's'} for '${query}'`;
}

/**
 * A stable 0-based index into the avatar/tint pool, from the product name.
 *
 * The mockup gives every product a semantic icon and tint — a droplet for shampoo, a leaf for aloe.
 * Nothing in the data supports that: parlour has no category API at all, and the mapper never
 * populates category names, so a product arrives with category IDs at best. Hashing the name at
 * least makes the colour stable per product and varied down the list, which is what the mockup's
 * thumbnails actually communicate at a glance.
 */
export function productTintIndex(name: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % poolSize;
}
