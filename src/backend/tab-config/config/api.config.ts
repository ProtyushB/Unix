/**
 * API Configuration for Tab Config Module
 *
 * Port of `Centrix/src/backend/tab-config/config/api.config.js`. The mobile
 * navbar gates on exactly the same per-business tab map the web sidebar uses,
 * so these constants must stay in lockstep with the web copy.
 *
 * Not ported: web's `CHANGE_EVENT` / `BUSINESS_CHANGE_EVENT`. Those ride the DOM
 * event bus, which React Native has no analogue for — here the context value is
 * the propagation path, and business changes arrive via AppContext instead.
 */

import { PERSON_BASE_URL } from '../../person/config/api.config';

export const TAB_CONFIG_API_CONFIG = {
  /**
   * Informational only — requests go through `businessApiClient`, which is
   * already based at this URL. Kept so the module documents its own backend.
   */
  BASE_URL: PERSON_BASE_URL,
  ENDPOINTS: {
    TAB_CONFIG_BY_BUSINESS: (businessId: number | string) =>
      `/api/businesses/${businessId}/tab-config`,
  },
  /** Per-business AsyncStorage cache key, under Unix's `session:` namespace. */
  CACHE_KEY_PREFIX: 'session:tabconfig:',
  CACHE_TTL_MS: 5 * 60 * 1000,
} as const;

/**
 * Locked on regardless of what the server sends. `forceAlwaysOn` hard-writes
 * these `true`, which is what guarantees the navbar can never render empty and
 * the redirect always has somewhere to land.
 */
export const ALWAYS_ON_TABS = ['DASHBOARD', 'BILLS'] as const;

/**
 * The full TabKey set. `as const` matters: it makes `TabKey` a 20-member literal
 * union rather than `string`, which is what catches the singular/plural traps
 * (route `Consumptions` ⇄ key `CONSUMPTION`, route `StockTransfers` ⇄ key
 * `STOCK_TRANSFER`) at compile time in navGroups.
 */
export const DEFAULT_ALL_ON = {
  DASHBOARD: true,
  REPORTS: true,
  EMPLOYEES: true,
  CUSTOMERS: true,
  LOYALTY: true,
  WARRANTY_CLAIMS: true,
  EXPENSES: true,
  PRODUCTS: true,
  SERVICES: true,
  INVENTORY: true,
  CATEGORIES: true,
  ORDERS: true,
  APPOINTMENTS: true,
  PACKAGES: true,
  SUBSCRIPTIONS: true,
  SERVICE_PLANS: true,
  CONSUMPTION: true,
  WASTAGE: true,
  STOCK_TRANSFER: true,
  BILLS: true,
} as const;

export type TabKey = keyof typeof DEFAULT_ALL_ON;
export type TabMap = Record<TabKey, boolean>;

/**
 * Not-yet-released tabs. Until a business's real config loads these default to
 * HIDDEN (fail-closed), so an unresolved or still-loading state can never flash
 * an unreleased feature the way a permissive baseline would.
 */
export const RELEASE_GATED_TABS: readonly TabKey[] = ['PACKAGES', 'SUBSCRIPTIONS', 'SERVICE_PLANS'];

const TAB_KEYS = Object.keys(DEFAULT_ALL_ON) as TabKey[];

/**
 * Fail-closed baseline used while no business/config is resolved. Derived from
 * DEFAULT_ALL_ON so the two can't drift out of sync.
 */
export const DEFAULT_UNRESOLVED: TabMap = Object.freeze(
  TAB_KEYS.reduce((acc, key) => {
    acc[key] = RELEASE_GATED_TABS.includes(key) ? false : DEFAULT_ALL_ON[key];
    return acc;
  }, {} as TabMap),
);

export { TAB_KEYS };
