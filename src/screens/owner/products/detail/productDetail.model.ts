/**
 * Form mapping, the sale-unit ladder, and the payload builders for the Product Detail screen.
 *
 * RN-free on purpose, so the repo's plain-node jest covers it — `jest.config.js` matches
 * `*.test.ts` only, and anything that ends up in a `.tsx` is untestable here by construction.
 *
 * The single most important thing in this file is `toUpdatePayload`. `PUT /{module}Product` is a
 * FULL-OBJECT replace: `GenericProductService.updateProduct` copies every field off the request
 * onto the record, so a field missing from the request is not "left alone", it is erased. The
 * builder therefore starts from the DTO the server last gave us and overlays the edits, rather
 * than assembling a fresh object out of form inputs.
 */

import { formatPrice, formatSize } from '../product.model';

// Re-exported so the detail screen has one import surface. Both are shared with the list on
// purpose: a product's size and price must read identically in the row and on the record.
export { formatPrice, formatSize };

// ─── Types ───────────────────────────────────────────────────────────────────

/** One rung of the pricing ladder, exactly as the backend stores it in the `sale_units` JSONB. */
export interface SaleUnit {
  unit: string;
  perStock: number | null;
  price: number | string | null;
}

/**
 * A pack level while it is being edited. Held as STRINGS because a numeric input is a string on
 * every platform, and parsing on each keystroke turns "10" into 1 → 10 and "12." into 12.
 */
export interface PackLevel {
  unit: string;
  perStock: string;
  price: string;
}

/** Loose server product. The DTO carries far more than the form touches, and that is the point. */
export interface ProductDetailItem {
  id?: number | null;
  businessId?: number | null;
  [k: string]: unknown;
}

export interface ProductFormState {
  name: string;
  brand: string;
  manufacturer: string;
  description: string;
  volume: string;
  volumeUnit: string;
  stockUnit: string;
  price: string;
  packs: PackLevel[];
  safetyWarning: string;
  packagingType: string;
  trackInventory: boolean;
  isOrderRequired: boolean;
  productType: string;
  /** Module-specific fields, kept flat and opaque so the generic layer never has to know them. */
  extras: Record<string, unknown>;
}

/**
 * Server-derived keys that must NOT be echoed back on a write.
 *
 * `availability`/`availableQuantity` are computed by `enrich` from the inventory batches;
 * `createdAt`/`updatedAt` are audit columns; `categorySet` is always null by design in both
 * mappers.
 * Everything else on the DTO round-trips — including `categoryIds`, which is deliberate: the
 * update path reads categories off the incoming entity, so omitting it CLEARS whatever the web
 * portal set. Categories have no mobile UI; they still must survive a mobile save.
 */
export const DERIVED_KEYS = [
  'availability',
  'availableQuantity',
  'createdAt',
  'updatedAt',
  'categorySet',
] as const;

// ─── Primitives ──────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** '' → null. Used where the column is nullable and an empty box means "not set", not zero. */
export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * `volume` is `Integer @PositiveOrZero` server-side. An empty field must serialise as null — `''`
 * is a 400 and `0` is a lie about a product nobody measured.
 */
export function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.trunc(n);
}

// ─── The sale-unit ladder ────────────────────────────────────────────────────

/**
 * Split a stored ladder into the base row and its pack levels.
 *
 * Packs are everything AFTER index 0, by POSITION. Never filter by `perStock > 1`: a pack's
 * `perStock` passes through 1 while someone types "10", and a value filter makes the row they are
 * editing vanish under their fingers. This is carried over verbatim from the web implementation,
 * where it was learned the hard way.
 */
export function readLadder(saleUnits: unknown): { packs: PackLevel[] } {
  const list = Array.isArray(saleUnits) ? (saleUnits as SaleUnit[]) : [];
  const hasBase = list.length > 0 && list[0]?.perStock === 1;
  const packRows = hasBase ? list.slice(1) : list;
  return {
    packs: packRows.map((p) => ({
      unit: str(p?.unit),
      perStock: p?.perStock === null || p?.perStock === undefined ? '' : String(p.perStock),
      price: p?.price === null || p?.price === undefined ? '' : String(p.price),
    })),
  };
}

/**
 * Rebuild the stored ladder as `[base, ...packs]`.
 *
 * The base row is ALWAYS emitted, even when its name is blank — blank is left blank so validation
 * can flag it, rather than silently dropping the row and letting the server invent one.
 */
export function writeLadder(stockUnit: string, basePrice: string, packs: PackLevel[]): SaleUnit[] {
  return [
    { unit: str(stockUnit).trim(), perStock: 1, price: toNumberOrNull(basePrice) },
    ...packs.map((p) => ({
      unit: str(p.unit).trim(),
      perStock: toIntOrNull(p.perStock),
      price: toNumberOrNull(p.price),
    })),
  ];
}

export function addPack(packs: PackLevel[]): PackLevel[] {
  return [...packs, { unit: '', perStock: '', price: '' }];
}

export function removePack(packs: PackLevel[], index: number): PackLevel[] {
  return packs.filter((_, i) => i !== index);
}

export function updatePack(
  packs: PackLevel[],
  index: number,
  field: keyof PackLevel,
  value: string,
): PackLevel[] {
  return packs.map((p, i) => (i === index ? { ...p, [field]: value } : p));
}

/** "2nd level", "3rd level" — `index` is the pack's position, so the base is never numbered. */
export function packLevelLabel(index: number): string {
  const n = index + 2;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix} level`;
}

/** "Box ×20 · ₹520" — one rung, for the read-only view. */
export function formatPackLevel(p: SaleUnit): string {
  const unit = str(p?.unit).trim() || 'unit';
  const per = p?.perStock ?? null;
  const price = toNumberOrNull(p?.price);
  const head = per === null ? unit : `${unit} ×${per}`;
  return price === null ? head : `${head} · ${formatPrice(price)}`;
}

/** Every rung above the base, or "None" — what the view's "Pack levels" row shows. */
export function formatLadderSummary(saleUnits: unknown): string {
  const list = Array.isArray(saleUnits) ? (saleUnits as SaleUnit[]) : [];
  const hasBase = list.length > 0 && list[0]?.perStock === 1;
  const packs = hasBase ? list.slice(1) : list;
  if (!packs.length) return 'None';
  return packs.map(formatPackLevel).join(' · ');
}

// ─── View-side formatting ────────────────────────────────────────────────────

/**
 * "42 pieces" / "1 piece", or '' when there is no number to show.
 *
 * Null quantity is NOT zero — it means the product is untracked, or the business has the Inventory
 * tab off. Rendering "0 pieces" for either is the bug this guards.
 */
export function stockLine(quantity: number | null | undefined, stockUnit: unknown): string {
  if (quantity === null || quantity === undefined) return '';
  const unit = str(stockUnit).trim();
  if (!unit) return String(quantity);
  return `${quantity} ${quantity === 1 ? unit : `${unit}s`}`;
}

/** "₹349 / tablet", or a bare price when the product has no stock unit. */
export function priceWithUnit(price: unknown, stockUnit: unknown): string {
  const money = formatPrice(toNumberOrNull(price) ?? 0);
  const unit = str(stockUnit).trim();
  return unit ? `${money} / ${unit}` : money;
}

// ─── Images ──────────────────────────────────────────────────────────────────

/** A file already attached to the product, as the DTO carries it. */
export interface ProductFile {
  dmsFileId?: number;
  /** Nullable, not merely optional: the column is nullable and `toDmsFiles` writes null. */
  fileName?: string | null;
  [k: string]: unknown;
}

/** A file the user has picked but not yet uploaded. */
// Re-exported so the detail screen keeps one import surface. Defined in the shared module because
// the service screen needs the identical shape, and because the mapping that produces it is the
// exact thing that broke — one copy, under test.
export type { PendingFile } from '../../shared/detail/pendingFiles';

export function productFiles(item: ProductDetailItem | null): ProductFile[] {
  return Array.isArray(item?.files) ? (item?.files as ProductFile[]) : [];
}

/**
 * Which already-attached files the user removed while editing.
 *
 * Compared by `dmsFileId` rather than by object identity — the form holds copies, and the whole
 * point is to find the ones that are no longer in the kept list.
 */
export function removedFiles(original: ProductFile[], kept: ProductFile[]): ProductFile[] {
  const keptIds = new Set(kept.map((f) => f.dmsFileId).filter((id) => id != null));
  return original.filter((f) => f.dmsFileId != null && !keptIds.has(f.dmsFileId));
}

/**
 * Does the DMS folder need creating or renaming before an upload?
 *
 * Two cases, both from the web portal: there are files to upload and no folder yet, or the folder
 * exists but the product's name changed — the backend names the folder `{name}_{id}`, so a rename
 * has to be pushed or the folder and the product drift apart.
 */
export function needsFolder(
  dmsFolderId: number | null,
  pendingCount: number,
  nameChanged: boolean,
): boolean {
  if (pendingCount > 0 && dmsFolderId == null) return true;
  return dmsFolderId != null && nameChanged;
}

// ─── DTO ↔ form ──────────────────────────────────────────────────────────────

/**
 * Seed the form from a server DTO. `extraKeys` is the module's own field list, so the generic
 * layer carries parlour's `skinType` and pharmacy's `dosageForm` without naming either.
 */
export function toFormState(
  item: ProductDetailItem,
  extraKeys: readonly string[] = [],
): ProductFormState {
  const extras: Record<string, unknown> = {};
  for (const key of extraKeys) extras[key] = item[key] ?? null;

  return {
    name: str(item.name),
    brand: str(item.brand),
    manufacturer: str(item.manufacturer),
    description: str(item.description),
    volume: item.volume === null || item.volume === undefined ? '' : String(item.volume),
    volumeUnit: str(item.volumeUnit),
    stockUnit: str(item.stockUnit),
    price: item.price === null || item.price === undefined ? '' : String(item.price),
    packs: readLadder(item.saleUnits).packs,
    safetyWarning: str(item.safetyWarning),
    packagingType: str(item.packagingType),
    // Primitive `boolean` server-side: anything other than an explicit true is false there too.
    trackInventory: item.trackInventory === true,
    // `@ColumnDefault("true")`, so an absent value means true rather than false.
    isOrderRequired: item.isOrderRequired !== false,
    productType: str(item.productType) || 'NORMAL',
    extras,
  };
}

/** The fields the form is allowed to write. Everything else on the DTO passes through untouched. */
function editedFields(form: ProductFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    brand: form.brand.trim(),
    manufacturer: form.manufacturer.trim(),
    description: form.description.trim(),
    volume: toIntOrNull(form.volume),
    volumeUnit: form.volumeUnit.trim(),
    stockUnit: form.stockUnit.trim(),
    price: toNumberOrNull(form.price) ?? 0,
    saleUnits: writeLadder(form.stockUnit, form.price, form.packs),
    safetyWarning: form.safetyWarning.trim(),
    packagingType: form.packagingType.trim(),
    // ALWAYS present. `trackInventory` is a Java primitive `boolean` and the update calls
    // `setTrackInventory(newData.isTrackInventory())` unconditionally — omit it and Jackson
    // defaults it to false, silently untracking a tracked product.
    trackInventory: Boolean(form.trackInventory),
    isOrderRequired: Boolean(form.isOrderRequired),
    ...form.extras,
  };
}

/**
 * Build the body for `PUT /{module}Product`.
 *
 * Starts from `serverItem` — the DTO as last fetched — and overlays the edits, because the server
 * replaces the whole record. Three fields are easy to lose and each has its own reason:
 *
 *  - `trackInventory` — primitive boolean, see above.
 *  - `files` — the update does `setFiles(x != null ? x : new ArrayList<>())`, so omitting it
 *    unlinks every image from the product.
 *  - `categoryIds` — the update reads categories off the incoming entity, so omitting it clears
 *    the categories the web portal set. There is no mobile category UI; it still round-trips.
 */
export function toUpdatePayload(
  serverItem: ProductDetailItem,
  form: ProductFormState,
  files: unknown[],
  dmsFolderId: number | null,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...serverItem };
  for (const key of DERIVED_KEYS) delete base[key];

  return {
    ...base,
    ...editedFields(form),
    id: serverItem.id,
    businessId: serverItem.businessId,
    files: files ?? [],
    ...(dmsFolderId != null ? { dmsFolderId } : {}),
  };
}

/**
 * Build the body for `POST /{module}Product`. No id, no folder yet — both arrive after the save.
 *
 * Defaults fill only the gaps. Spreading them under `editedFields` would not work: a form seeded
 * from an empty record has every module field at `null`, and null overwrites a default rather than
 * deferring to it, so a new pharmacy product would post `isOTC: null` instead of `true`.
 */
export function buildCreatePayload(
  form: ProductFormState,
  businessId: number,
  extraDefaults: Record<string, unknown> = {},
): Record<string, unknown> {
  const fields = editedFields(form);
  for (const [key, value] of Object.entries(extraDefaults)) {
    if (fields[key] === null || fields[key] === undefined) fields[key] = value;
  }
  return {
    ...fields,
    businessId,
    productType: form.productType || 'NORMAL',
    files: [],
  };
}
