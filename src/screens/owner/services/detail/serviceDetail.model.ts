/**
 * Form mapping and the payload builders for the Service Detail screen.
 *
 * RN-free on purpose, so the repo's plain-node jest covers it — `jest.config.js` matches
 * `*.test.ts` only, and anything that ends up in a `.tsx` is untestable here by construction.
 *
 * The single most important thing in this file is `toUpdatePayload`. `PUT /{module}Service` is a
 * FULL-OBJECT replace: `GenericServiceService.updateService` copies every field off the request
 * onto the record, so a field missing from the request is not "left alone", it is erased. The
 * builder therefore starts from the DTO the server last gave us and overlays the edits, rather
 * than assembling a fresh object out of form inputs.
 */

import { formatDuration, formatPrice } from '../service.model';

// Re-exported so the detail screen has one import surface, and shared with the list on purpose:
// a service's price and duration must read identically in the row and on the record.
export { formatDuration, formatPrice };

// ─── Types ───────────────────────────────────────────────────────────────────

/** Loose server service. The DTO carries far more than the form touches, and that is the point. */
export interface ServiceDetailItem {
  id?: number | null;
  businessId?: number | null;
  [k: string]: unknown;
}

export interface ServiceFormState {
  name: string;
  description: string;
  /** Kept as strings: a numeric input is a string on every platform. */
  price: string;
  duration: string;
  availability: boolean;
  isAppointmentRequired: boolean;
  /** Products this service consumes. IDs only — the server stores no quantities. */
  requiredProductIds: number[];
  /** Module-specific fields, kept flat and opaque so the generic layer never has to know them. */
  extras: Record<string, unknown>;
}

/**
 * Server-derived keys that must NOT be echoed back on a write.
 *
 * Three, where products have five — and the two that are absent are the whole difference:
 *
 *  - `availability` is NOT derived for a service. On a product it is computed by `enrich` from the
 *    inventory batches. Here it is a stored, owner-set flag on a `@Column(nullable = false)
 *    @ColumnDefault("true")` column, with no `@NotNull` on the DTO and no default in `@PrePersist`.
 *    `updateService` copies it unguarded, so omitting it writes NULL into a NOT NULL column: an
 *    HTTP 500, not a silent `false`. Copying the product list across breaks every single save.
 *  - `availableQuantity` does not exist on a service. There is no inventory behind one.
 *
 * `categorySet` stays: both mappers leave it null by design. `categoryIds` is deliberately NOT
 * here — the update reads categories off the incoming entity, so omitting it CLEARS whatever the
 * web portal set. Same for pharmacy's `requirements`. Neither has a mobile UI; both must survive
 * a mobile save.
 */
export const DERIVED_KEYS = ['createdAt', 'updatedAt', 'categorySet'] as const;

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
 * `duration` is a nullable `Integer` of minutes. An empty field must serialise as null — `0` would
 * claim the service takes no time, which is a different statement from "nobody said".
 */
export function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.trunc(n);
}

// ─── Images ──────────────────────────────────────────────────────────────────

/** One attached DMS file, as the server stores it. Loose — the strip only needs the id. */
export interface ServiceFile {
  dmsFileId?: number;
  fileName?: string;
  [k: string]: unknown;
}

/** An image picked on the device but not yet uploaded. */
export interface PendingFile {
  uri: string;
  fileName: string;
  type: string;
}

export function serviceFiles(item: ServiceDetailItem | null): ServiceFile[] {
  return Array.isArray(item?.files) ? (item?.files as ServiceFile[]) : [];
}

/** Files present on the record but no longer in the form — the ones to delete from DMS. */
export function removedFiles(original: ServiceFile[], kept: ServiceFile[]): ServiceFile[] {
  const keptIds = new Set(kept.map((f) => f.dmsFileId).filter((id) => id != null));
  return original.filter((f) => f.dmsFileId != null && !keptIds.has(f.dmsFileId));
}

/** A folder is needed the first time images arrive, and again whenever the name changes. */
export function needsFolder(
  currentFolderId: number | null,
  hasNewFiles: boolean,
  nameChanged: boolean,
): boolean {
  if (currentFolderId == null) return hasNewFiles;
  return nameChanged;
}

// ─── Required products ───────────────────────────────────────────────────────

/** One pickable product. Names are for display only; the wire carries ids. */
export interface ProductOption {
  id: number;
  name: string;
}

/** Coerce whatever the jsonb column hands back into a clean id list. */
export function normalizeRequiredProductIds(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  for (const raw of v) {
    const n = toNumberOrNull(raw);
    if (n !== null && Number.isFinite(n)) seen.add(Math.trunc(n));
  }
  return [...seen];
}

export function toProductOptions(raw: unknown): ProductOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductOption[] = [];
  for (const item of raw) {
    const row = item as { id?: unknown; name?: unknown };
    const id = toNumberOrNull(row?.id);
    if (id === null) continue;
    out.push({ id: Math.trunc(id), name: str(row?.name).trim() || `#${Math.trunc(id)}` });
  }
  return out;
}

/**
 * A selected id's display name, falling back to `#12`.
 *
 * Not an edge case: `required_product_ids` is a bare jsonb column with no foreign key, so deleting
 * a product leaves its id behind on every service that referenced it, permanently.
 */
export function resolveProductName(options: ProductOption[], id: number): string {
  return options.find((o) => o.id === id)?.name ?? `#${id}`;
}

/**
 * Filter by name. Already-selected options are deliberately NOT excluded — they stay in the list
 * shown as selected, so tapping one again is how you deselect it.
 */
export function filterProductOptions(options: ProductOption[], query: string): ProductOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.name.toLowerCase().includes(q));
}

export function toggleProductId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// ─── DTO ⇄ form ──────────────────────────────────────────────────────────────

export function toFormState(
  item: ServiceDetailItem,
  extraKeys: readonly string[] = [],
): ServiceFormState {
  const extras: Record<string, unknown> = {};
  for (const key of extraKeys) extras[key] = item[key] ?? null;

  return {
    name: str(item.name),
    description: str(item.description),
    price: item.price === null || item.price === undefined ? '' : String(item.price),
    duration: item.duration === null || item.duration === undefined ? '' : String(item.duration),
    // `NOT NULL DEFAULT true`, so a legacy row arriving without it is available — matching
    // `toServiceRow`, so the badge on the list and the toggle on the record never disagree.
    availability: item.availability !== false,
    // Defaulted to true by the mapper when omitted, same reading.
    isAppointmentRequired: item.isAppointmentRequired !== false,
    requiredProductIds: normalizeRequiredProductIds(item.requiredProductIds),
    extras,
  };
}

function editedFields(form: ServiceFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    price: toNumberOrNull(form.price) ?? 0,
    duration: toIntOrNull(form.duration),
    // ALWAYS present, and emitted here rather than left to survive the `...serverItem` spread —
    // a DTO that never carried the key would leave it `undefined`, JSON.stringify would drop it,
    // and the PUT would 500 on a NOT NULL violation. See DERIVED_KEYS.
    availability: Boolean(form.availability),
    isAppointmentRequired: Boolean(form.isAppointmentRequired),
    // Also always present: the update copies this unguarded, so omitting it clears the list.
    requiredProductIds: [...form.requiredProductIds],
    ...form.extras,
  };
}

/**
 * Build the body for `PUT /{module}Service`.
 *
 * Starts from `serverItem` — the DTO as last fetched — and overlays the edits, because the server
 * replaces the whole record. Four fields are easy to lose and each has its own reason:
 *
 *  - `availability` — NOT NULL column, unguarded copy, no DTO default. Omit it and the save 500s.
 *  - `files` — the update does `setFiles(x != null ? x : new ArrayList<>())`, so omitting it
 *    unlinks every image from the service.
 *  - `categoryIds` — the update reads categories off the incoming entity, so omitting it clears
 *    the categories the web portal set. There is no mobile category UI; it still round-trips.
 *  - `requiredProductIds` — copied unguarded, so omitting it empties the list.
 *
 * The id goes in the BODY. `PUT /{module}Service` has no path variable, and a missing id resolves
 * to `checkIfServiceExists(null)` — a 404, not the 400 you would expect.
 */
export function toUpdatePayload(
  serverItem: ServiceDetailItem,
  form: ServiceFormState,
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
 * Build the body for `POST /{module}Service`. No id, no folder yet — both arrive after the save.
 *
 * Defaults fill only the gaps. Spreading them under `editedFields` would not work: a form seeded
 * from an empty record has every module field at `null`, and null overwrites a default rather than
 * deferring to it.
 *
 * `availability` and `isAppointmentRequired` are real booleans by the time they get here, so they
 * are never gap-filled — the segmented control and the switch both always have a position.
 */
export function buildCreatePayload(
  form: ServiceFormState,
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
    files: [],
  };
}
