/**
 * The Order Detail screen's mode machine, copy and validation.
 *
 * RN-free, so jest reaches it. Same split as `productDetail.view.ts` / `serviceDetail.view.ts`, and
 * the first block below is deliberately identical to both — three screens agreeing about what
 * "loading" means is worth more than three screens each having their own idea.
 */

import type { OrderFormState } from './orderDetail.model';

export type DetailMode = 'view' | 'edit' | 'add';
export type DetailView = 'LOADING' | 'ERROR' | 'READY' | 'SAVING';

// ─── Mode machine ────────────────────────────────────────────────────────────

/**
 * Precedence: saving → error → add-is-always-ready → loading.
 *
 * Add mode is ready before anything is fetched, because there is nothing to fetch. Ordering
 * `loading` first would leave the Add screen on a spinner forever.
 */
export function deriveDetailView(input: {
  mode: DetailMode;
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  hasItem: boolean;
}): DetailView {
  if (input.saving) return 'SAVING';
  if (input.hasError && !input.hasItem) return 'ERROR';
  if (input.mode === 'add') return 'READY';
  return input.loading || !input.hasItem ? 'LOADING' : 'READY';
}

export function isEditable(mode: DetailMode): boolean {
  return mode !== 'view';
}

export function showsDelete(mode: DetailMode): boolean {
  return mode === 'edit';
}

export function showsEditCta(mode: DetailMode): boolean {
  return mode === 'view';
}

// ─── Copy ────────────────────────────────────────────────────────────────────

/**
 * `moduleLabel` is the only thing that differs between parlour and pharmacy on this screen — the
 * mockup's own subtitle says so: "Parlour & pharmacy orders are identical (only the 'New
 * Parlour/Pharmacy Order' add-mode label differs)."
 */
export function appBarTitle(mode: DetailMode, orderNumber: string): string {
  if (mode === 'add') return 'New Order';
  if (mode === 'edit') return orderNumber || 'Edit order';
  return orderNumber || 'Order details';
}

export function appBarSubtitle(mode: DetailMode): string {
  if (mode === 'add') return 'Add a customer and items';
  if (mode === 'edit') return 'Edit order';
  return 'Order details';
}

/** "Save Order" when creating, "Save Changes" when editing — as drawn. */
export function saveLabel(mode: DetailMode): string {
  return mode === 'add' ? 'Save Order' : 'Save Changes';
}

// ─── Locks ───────────────────────────────────────────────────────────────────

/**
 * A billed order cannot be edited. The server enforces it too — any content or status change on an
 * order sitting on a FINALIZED bill answers 409 `ORDER_LOCKED` — so this is the polite half of a
 * rule that holds either way.
 */
export function canEdit(billed: boolean): boolean {
  return !billed;
}

export function lockedReason(billNumber: string | null | undefined): string {
  return billNumber
    ? `On bill ${billNumber} — cancel the bill to edit this order`
    : 'This order is on a bill — cancel the bill to edit it';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationErrors = Record<string, string>;

/**
 * Everything the server will not check.
 *
 * ⚠️ `@Valid` is MISSING on `POST`/`PUT /{module}Order` — `ParlourOrderController:33` and `:54`
 * take a bare `@RequestBody`, and there is no `@Validated` anywhere in Modulex. Every constraint
 * annotation on `OrderDto` is therefore dead code, and this function is the only thing standing
 * between a mistake and a 500.
 */
export function validateOrder(form: OrderFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  // NOT NULL server-side, and the mockup marks it required. Without this the save 500s.
  if (form.customerId == null) errors.customer = 'Pick a customer for this order.';

  if (!form.lines.length) errors.items = 'Add at least one item.';

  form.lines.forEach((line, index) => {
    if (!line.productId) errors[`line.${index}.product`] = 'This line has no product.';
    // `quantity` is @Positive on the DTO, but nothing enforces it — a zero-quantity line would be
    // accepted, deduct nothing, and read as a real line forever.
    if (!(line.quantity > 0)) errors[`line.${index}.quantity`] = 'Quantity must be at least 1.';
  });

  if (!form.orderStatus) errors.status = 'Pick a status.';

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The one-line summary shown on the Save button's toast, rather than every field's message. */
export function errorSummary(errors: ValidationErrors): string {
  return errors.customer || errors.items || 'Please fix the highlighted fields.';
}
