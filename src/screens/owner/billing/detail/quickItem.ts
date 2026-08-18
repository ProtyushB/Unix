/**
 * Quick Add — the third item source on a bill.
 *
 * A quick item is a product the user TYPES rather than picks: it is not in the catalog, it never
 * becomes a catalog row, and it spawns no order. It exists only as a line on this one bill, in
 * `CreateBillRequest.quickItems`, and comes back inside `bareProducts[]` flagged `adhoc: true`.
 *
 * That "no catalog row" property is not a UI choice — it is enforced by an ABSENCE. Every other
 * bare line carries a `productId` and is repriced from the live catalog on every write; a quick
 * item carries none, which is precisely what puts it out of reach of the catalog gate and the
 * stock ledger's product path. Adding a `productId` here would silently move these lines onto the
 * catalog channel, so this module never builds one.
 *
 * Everything here is pure and RN-free, which is what makes it testable: the repo's jest config
 * matches `*.test.ts` only and nothing renders.
 */

import { formatAmount } from '../bill.model';

import type { DmsFile, PendingFile } from '../../shared/detail/pendingFiles';

// ─── Shapes ──────────────────────────────────────────────────────────────────

/** The form as the user is filling it. Every field is a string — these come from `TextInput`. */
export interface QuickItemDraft {
  name: string;
  price: string;
  quantity: string;
  unit: string;
  /** The picked photo, staged locally. Uploaded only after the bill has an id. */
  photo: PendingFile | null;
}

/** One committed quick item, as it sits on the bill and goes out in `quickItems[]`. */
export interface QuickBillItem {
  /**
   * A client-minted UUID that is simultaneously the React key, the DMS folder key, the payload id
   * and the key the photos PATCH matches on. It is minted BEFORE the bill exists — there is no
   * server id to borrow — and never changes once minted.
   */
  lineId: string;
  name: string;
  price: number;
  quantity: number;
  /** '' when absent. Omitted from the payload rather than sent empty. */
  unit: string;
  /** Percent, 0-100. There is no UI to set it on create; an existing line's value is preserved. */
  discount: number;
  dmsFolderId: number | null;
  photos: DmsFile[];
  /**
   * The staged photo, present only between picking and a successful upload. Never persisted, and
   * cleared once the upload lands — unlike the web, RN has no object URL to revoke, so the picker
   * asset's own `uri` IS the preview and there is nothing to release.
   */
  photo: PendingFile | null;
}

/** `CreateBillRequest.quickItems[]`. Note what is NOT here: no `productId`, no `kind`. */
export interface QuickItemWrite {
  lineId: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  discount?: number;
  dmsFolderId?: number;
  photos?: DmsFile[];
}

export type ValidationErrors = Record<string, string>;

// ─── Draft ───────────────────────────────────────────────────────────────────

export const emptyQuickDraft = (): QuickItemDraft => ({
  name: '',
  price: '',
  quantity: '',
  unit: '',
  photo: null,
});

/**
 * A fresh `lineId`.
 *
 * Via `uuid` rather than `crypto.randomUUID()`, which stock Hermes does not have — and neither is
 * `crypto.getRandomValues` there to hand-roll one with. `react-native-get-random-values` is
 * imported at `App.tsx:2` for exactly this, and `EntityFolderUtils` / `ToastContext` already take
 * the same route. The id must be a real UUID: the server parses it as one, so an invented format
 * is a 400 rather than a wrong-looking string.
 */
export { v4 as newLineId } from 'uuid';

/**
 * Everything wrong with the draft, keyed by field.
 *
 * Deliberately stricter than the server on price. The API accepts `>= 0`; a zero-priced ad-hoc
 * line is almost always a half-typed one, and unlike a catalog product there is no row to check it
 * against afterwards. Quantity is the opposite case — blank is legal and MEANS one, so only a
 * typed-and-wrong value is an error.
 */
export function validateQuickDraft(draft: QuickItemDraft): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.name.trim()) errors.name = 'Name is required';

  if (draft.price === '' || draft.price === null || draft.price === undefined) {
    errors.price = 'Price is required';
  } else {
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) errors.price = 'Enter a price greater than 0';
  }

  if (draft.quantity !== '') {
    const qty = Number(draft.quantity);
    if (!Number.isFinite(qty) || qty < 1) errors.quantity = 'Quantity must be at least 1';
  }

  return errors;
}

/**
 * Turn a VALID draft into a committed item. Callers run `validateQuickDraft` first — this does no
 * checking of its own, it only coerces.
 */
export function commitQuickDraft(draft: QuickItemDraft, lineId: string): QuickBillItem {
  return {
    lineId,
    name: draft.name.trim(),
    price: Number(draft.price),
    // A blank quantity means one. `Number('') || 1` would also give 1, but so would `Number('0')`
    // taking the wrong branch, so the floor is explicit.
    quantity: Math.max(1, Number(draft.quantity) || 1),
    unit: draft.unit.trim(),
    discount: 0,
    dmsFolderId: null,
    photos: [],
    photo: draft.photo,
  };
}

// ─── Money ───────────────────────────────────────────────────────────────────

/** One line's net, after its own percentage discount. Clamped, so a bad stored value cannot invert. */
export function quickLineTotal(item: {
  price?: number;
  quantity?: number;
  discount?: number;
}): number {
  const qty = item.quantity ?? 0;
  const price = item.price ?? 0;
  const pct = Math.min(Math.max(item.discount ?? 0, 0), 100);
  return qty * price * (1 - pct / 100);
}

export function quickTotal(items: QuickBillItem[]): number {
  return items.reduce((sum, item) => sum + quickLineTotal(item), 0);
}

// ─── Copy ────────────────────────────────────────────────────────────────────

/**
 * The line's meta string, which reads differently on each of the two surfaces it appears on.
 *
 *   picker → "Qty 2 · ₹450 · jar"        the QUICK ITEMS list inside the Add-items sheet
 *   bill   → "Quick add · 2 × ₹450 · jar" the BILLED ITEMS list, where it sits beside order rows
 *                                          and has to say what KIND of line it is
 *
 * The unit segment is dropped when there is no unit rather than rendered as a trailing separator.
 */
export function quickItemMeta(
  item: { price?: number; quantity?: number; unit?: string },
  surface: 'picker' | 'bill',
): string {
  const qty = item.quantity ?? 1;
  const price = formatAmount(item.price ?? 0);
  const head = surface === 'bill' ? ['Quick add', `${qty} × ${price}`] : [`Qty ${qty}`, price];
  return [...head, item.unit?.trim() || null].filter(Boolean).join(' · ');
}

/** The Add-items sheet's footer while the Quick Add tab is showing. */
export function doneLabel(items: QuickBillItem[]): string {
  if (!items.length) return 'Done';
  const count = `${items.length} item${items.length === 1 ? '' : 's'}`;
  return `Done · ${count} · ${formatAmount(quickTotal(items))}`;
}

/** The QUICK ITEMS header's right-hand count. Always plural-aware, including at zero. */
export function quickCountLabel(items: QuickBillItem[]): string {
  return `${items.length} item${items.length === 1 ? '' : 's'}`;
}
