/**
 * Tab-config normalisation
 *
 * One place that turns a raw `/tab-config` payload — or a cache entry — into the
 * snapshot the app renders from. Applied on the network path AND re-applied on
 * cache read, so a stale or hand-edited cache entry can never bypass the
 * always-on guarantee.
 *
 * Mirrors the inline logic in `Centrix/src/backend/tab-config/provider/
 * tab-config.provider.jsx` (`forceAlwaysOn` + the `!== false` flag defaults),
 * hoisted out of the provider so the three write paths can't drift apart.
 */

import {
  ALWAYS_ON_TABS,
  DEFAULT_ALL_ON,
  DEFAULT_UNRESOLVED,
  type TabMap,
} from '../config/api.config';

/** Platform-wide feature gates that ride the same payload as the tab map. */
export interface TabConfigFlags {
  comboEnabled: boolean;
  notificationsEnabled: boolean;
  reimbursementEnabled: boolean;
  productCategoryEnabled: boolean;
  serviceCategoryEnabled: boolean;
  expenseCategoryEnabled: boolean;
  emiOnBillEnabled: boolean;
  listViewEnabled: boolean;
  gridViewEnabled: boolean;
}

export interface TabConfigSnapshot extends TabConfigFlags {
  /** Effective map — module capability ∧ platform availability ∧ owner preference. */
  tabs: TabMap;
  /** Raw owner intent. Settings-panel input on web; unused on mobile today. */
  preferences: TabMap;
  meta: unknown | null;
}

/** Raw shape of `response.data.data` from GET/PUT `/tab-config`. */
export interface TabConfigPayload extends Partial<TabConfigFlags> {
  businessId?: number;
  tabs?: Partial<TabMap>;
  preferences?: Partial<TabMap>;
  meta?: unknown;
}

/**
 * Merge over the all-on baseline (so a key the server omits defaults ON, matching
 * web), then hard-write the always-on tabs regardless of what arrived.
 */
export function forceAlwaysOn(tabs: Partial<TabMap> | null | undefined): TabMap {
  const next = { ...DEFAULT_ALL_ON, ...(tabs || {}) } as TabMap;
  for (const key of ALWAYS_ON_TABS) next[key] = true;
  return next;
}

/** Permissive flag default: only an explicit `false` from the server turns one off. */
function flag(value: boolean | undefined): boolean {
  return value !== false;
}

export function normalizeTabConfig(
  raw: TabConfigPayload | null | undefined,
): TabConfigSnapshot {
  return {
    tabs: forceAlwaysOn(raw?.tabs),
    preferences: forceAlwaysOn(raw?.preferences ?? raw?.tabs),
    meta: raw?.meta ?? null,
    comboEnabled: flag(raw?.comboEnabled),
    notificationsEnabled: flag(raw?.notificationsEnabled),
    reimbursementEnabled: flag(raw?.reimbursementEnabled),
    productCategoryEnabled: flag(raw?.productCategoryEnabled),
    serviceCategoryEnabled: flag(raw?.serviceCategoryEnabled),
    expenseCategoryEnabled: flag(raw?.expenseCategoryEnabled),
    emiOnBillEnabled: flag(raw?.emiOnBillEnabled),
    listViewEnabled: flag(raw?.listViewEnabled),
    gridViewEnabled: flag(raw?.gridViewEnabled),
  };
}

/**
 * What the app renders before a real config lands (or when there's no business).
 * Release-gated tabs are OFF here — that's the fail-closed first paint.
 */
export const UNRESOLVED_SNAPSHOT: TabConfigSnapshot = Object.freeze({
  ...normalizeTabConfig(null),
  tabs: { ...DEFAULT_UNRESOLVED },
});
