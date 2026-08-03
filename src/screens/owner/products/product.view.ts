/**
 * The Products screen's view state machine, extracted so it can be unit tested.
 *
 * Same shape as `bill.view.ts` and for the same reason: this is where screens of this kind actually
 * break, and keeping it pure lets the plain-node jest cover every branch without a render harness.
 */

import type { ProductRow } from './product.model';

export type ProductView =
  | 'ERROR'
  | 'LOADING'
  | 'MAIN'
  | 'EMPTY'
  | 'SEARCH_IDLE'
  | 'SEARCHING'
  | 'SEARCH_RESULTS'
  | 'NO_RESULTS';

export interface ProductViewInput {
  /** 'browse' | 'search' — whether the search field is active. */
  mode: 'browse' | 'search';
  /** The debounced query. Empty while the box is focused but nothing typed. */
  query: string;
  /** Rows held for the active fetch. */
  rowCount: number;
  /** True once a request has completed at least once — never a plain `!loading`. */
  loadedOnce: boolean;
  hasError: boolean;
}

/**
 * Precedence, top-down: error wins, then the search branch, then first-load, then browse.
 *
 * ERROR first because a failed load makes every other distinction meaningless — an empty list from
 * a request that never returned is not "no products yet".
 *
 * Note there is no FILTERED / FILTERED_EMPTY pair here, unlike Bills and Orders. Those exist to
 * tell "no bills at all" apart from "no bills matching this chip", and the Products mockups have no
 * status chips to filter by — a product has no status. Sorting reorders the same rows, it never
 * empties the list, so it cannot produce a filtered-empty state.
 */
export function deriveProductView(i: ProductViewInput): ProductView {
  if (i.hasError) return 'ERROR';

  if (i.mode === 'search') {
    // A focused box with nothing typed is not a search. Rendering "0 results for ''" for a query
    // nobody performed is the bug this state exists to prevent — Orders shipped it once.
    if (!i.query) return 'SEARCH_IDLE';
    if (!i.loadedOnce) return 'SEARCHING';
    return i.rowCount > 0 ? 'SEARCH_RESULTS' : 'NO_RESULTS';
  }

  if (!i.loadedOnce) return 'LOADING';
  return i.rowCount === 0 ? 'EMPTY' : 'MAIN';
}

/**
 * Whether the inline Add button shows.
 *
 * Note this is the button in the search row, not a FAB — the Products mockups have no FAB at all,
 * unlike every other list screen in the app. It hides on EMPTY because that hero already offers
 * "Add Product", and on ERROR where the primary action is Retry.
 */
export function showsProductAdd(view: ProductView): boolean {
  return view !== 'EMPTY' && view !== 'ERROR';
}

/**
 * Whether the header may auto-hide on scroll.
 *
 * Only MAIN and SEARCH_RESULTS — the two states with a scrollable list under them. Search still
 * collapses, unlike Bills, because the mockup's collapsing block is the title and the search row,
 * and the search field remains reachable by scrolling back up. The hero states have nothing to
 * scroll, so collapsing there would just strand the user without a search box.
 */
export function productHeaderCollapses(view: ProductView): boolean {
  return view === 'MAIN' || view === 'SEARCH_RESULTS';
}

export function isProductSearchView(view: ProductView): boolean {
  return (
    view === 'SEARCH_IDLE' ||
    view === 'SEARCHING' ||
    view === 'SEARCH_RESULTS' ||
    view === 'NO_RESULTS'
  );
}

/**
 * Whether the catalog panel header ("Product Catalog" + counts + sort) renders.
 *
 * Browse only. In search mode the mockup replaces the whole band with a result count, and sorting
 * a search result set is not something the design offers.
 */
export function showsCatalogPanel(view: ProductView): boolean {
  return view === 'MAIN';
}

// ─── Sort ────────────────────────────────────────────────────────────────────

export interface SortOption {
  key: string;
  label: string;
  /** Server-whitelisted field. Anything outside the whitelist silently falls back to `id`. */
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

/**
 * The sort picker's options, all four already accepted by the server.
 *
 * Name ascending is first and is the screen's default. The server's own default is `id` ascending —
 * i.e. oldest product first — which is why the screen always sends an explicit sort rather than
 * letting the endpoint choose.
 */
export const SORT_OPTIONS: SortOption[] = [
  { key: 'name_asc', label: 'Name A–Z', sortBy: 'name', sortDir: 'asc' },
  { key: 'name_desc', label: 'Name Z–A', sortBy: 'name', sortDir: 'desc' },
  { key: 'price_asc', label: 'Price low to high', sortBy: 'price', sortDir: 'asc' },
  { key: 'price_desc', label: 'Price high to low', sortBy: 'price', sortDir: 'desc' },
  { key: 'created_desc', label: 'Recently added', sortBy: 'createdAt', sortDir: 'desc' },
  { key: 'brand_asc', label: 'Brand A–Z', sortBy: 'brand', sortDir: 'asc' },
];

export const DEFAULT_SORT_KEY = 'name_asc';

/** The picker's trigger shows a short form — "Name", not "Name A–Z". */
export function sortTriggerLabel(key: string): string {
  const opt = SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
  return opt.label.replace(/ (A–Z|Z–A|low to high|high to low)$/, '');
}

export function sortOptionFor(key: string): SortOption {
  return SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
}

// ─── Quick actions ───────────────────────────────────────────────────────────

export interface ProductAction {
  key: 'edit' | 'tracking' | 'delete';
  label: string;
  /** Palette role for the ICON. Independent of `danger`, which tints the LABEL. */
  tint: 'success' | 'warning' | 'info' | 'error' | 'muted';
  danger?: boolean;
  /** Needs a confirm dialog before firing. */
  confirm?: 'delete';
  /** Not yet built — rendered, but inert. */
  todo?: boolean;
}

/**
 * The three rows of the quick-actions sheet.
 *
 * "Edit product" is drawn in the mockup but has nowhere to go: the set contains no create/edit
 * form, and the old ProductDetailScreen is orphaned and excluded from typechecking. It is rendered
 * rather than omitted so the sheet matches the design, and marked `todo` so the screen can no-op it
 * deliberately instead of navigating somewhere broken.
 *
 * The tracking row's label flips with the product's current state — the mockup only ever draws the
 * "off" direction because every product it shows is tracked.
 */
export function quickActionsFor(row: ProductRow): ProductAction[] {
  return [
    { key: 'edit', label: 'Edit product', tint: 'muted', todo: true },
    {
      key: 'tracking',
      label: row.trackInventory ? 'Turn off tracking' : 'Turn on tracking',
      tint: 'muted',
    },
    { key: 'delete', label: 'Delete product', tint: 'error', danger: true, confirm: 'delete' },
  ];
}
