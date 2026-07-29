/**
 * Tab Config Provider — REACT CONTEXT, not the DI singleton.
 *
 * Note the naming clash: every other `src/backend/*\/provider/` file in this app
 * is a lazy-singleton DI seam (`getBusinessApi()` / `setBusinessApi()`). This one
 * is a React context provider, because it mirrors
 * `Centrix/src/backend/tab-config/provider/tab-config.provider.jsx` file-for-file
 * and keeping the two ports structurally aligned is worth more than matching the
 * local folder idiom.
 *
 * Divergences from the web provider, all deliberate:
 *  - Business id resolution is ASYNC here (AsyncStorage), so the provider exposes
 *    `resolved` alongside `loading`. Web can gate on `loading` because its
 *    localStorage read is synchronous; on mobile there is a real window where
 *    `loading === false` and the config is still the fail-closed default.
 *  - The no-provider default context is FAIL-CLOSED. Web's is permissive purely
 *    so isolated unit tests don't need a wrapper; here a mis-mounted provider
 *    must not silently un-hide release-gated tabs.
 *  - Refetch triggers are AppContext business change + AppState foreground,
 *    replacing web's `centrix:business-change` CustomEvent and `storage` listener.
 *  - `updateTabs` is not ported — there is no mobile settings panel to call it.
 */

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALWAYS_ON_TABS,
  DEFAULT_UNRESOLVED,
  TAB_CONFIG_API_CONFIG,
} from '../config/api.config';
import {
  UNRESOLVED_SNAPSHOT,
  normalizeTabConfig,
  type TabConfigPayload,
  type TabConfigSnapshot,
} from '../util/tab-config.normalize';
import tabConfigService from '../service/tab-config.service';
import { useAppContext } from '../../../context/AppContext';
import { findBusiness } from '../../../storage/session.storage';

const ALWAYS_ON_SET = new Set<string>(ALWAYS_ON_TABS);

// ─── Context Shape ───────────────────────────────────────────────────────────

export interface TabConfigContextValue extends TabConfigSnapshot {
  businessId: number | null;
  loading: boolean;
  error: string | null;
  /**
   * True once a snapshot has actually been applied for the current business —
   * from cache, from the network, or because there is no business at all.
   * Anything that ACTS on the config (the redirect) must wait for this; anything
   * that merely renders it can read `tabs` immediately, since the default is safe.
   */
  resolved: boolean;
  refetch: () => Promise<void>;
  isAlwaysOn: (tabKey: string) => boolean;
}

const DEFAULT_CONTEXT: TabConfigContextValue = {
  ...UNRESOLVED_SNAPSHOT,
  tabs: { ...DEFAULT_UNRESOLVED },
  businessId: null,
  loading: false,
  error: null,
  resolved: false,
  refetch: async () => {},
  isAlwaysOn: (tabKey: string) => ALWAYS_ON_SET.has(tabKey),
};

export const TabConfigContext = createContext<TabConfigContextValue>(DEFAULT_CONTEXT);

// ─── Cache ───────────────────────────────────────────────────────────────────
// Two tiers. AsyncStorage survives process death; the in-memory mirror is what
// makes a warm remount paint on the FIRST frame — web reads sessionStorage
// synchronously, and without this mirror every mount here would fail closed for
// a beat even with a valid cached config.

interface CacheEntry {
  snapshot: TabConfigSnapshot;
  ts: number;
}

const memoryCache = new Map<number, CacheEntry>();

/** Last business we resolved, so a remount can seed state before any await. */
let lastResolvedBusinessId: number | null = null;

function cacheKey(businessId: number): string {
  return `${TAB_CONFIG_API_CONFIG.CACHE_KEY_PREFIX}${businessId}`;
}

function isFresh(ts: number): boolean {
  return Date.now() - ts <= TAB_CONFIG_API_CONFIG.CACHE_TTL_MS;
}

function readMemoryCache(businessId: number | null): CacheEntry | null {
  if (businessId == null) return null;
  const entry = memoryCache.get(businessId);
  if (!entry || !isFresh(entry.ts)) return null;
  return entry;
}

async function readCache(businessId: number): Promise<CacheEntry | null> {
  const inMemory = readMemoryCache(businessId);
  if (inMemory) return inMemory;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(businessId));
    if (!raw) return null;
    // A stored snapshot is structurally a payload, so it round-trips cleanly.
    const parsed = JSON.parse(raw) as { snapshot?: TabConfigPayload; ts?: number };
    if (!parsed?.ts || !isFresh(parsed.ts)) return null;
    // Re-normalise: a stale or hand-edited entry must not bypass forceAlwaysOn.
    const snapshot = normalizeTabConfig(parsed.snapshot);
    const entry: CacheEntry = { snapshot, ts: parsed.ts };
    memoryCache.set(businessId, entry);
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(businessId: number, snapshot: TabConfigSnapshot): Promise<void> {
  const entry: CacheEntry = { snapshot, ts: Date.now() };
  memoryCache.set(businessId, entry);
  try {
    await AsyncStorage.setItem(cacheKey(businessId), JSON.stringify(entry));
  } catch {
    // Storage full / blocked — the memory mirror still serves this session.
  }
}

/**
 * Drop every cached tab config. `session.storage.clearAll()` can't do this — it
 * removes a fixed key list, and these keys are per-business suffixed. Call from
 * the logout path.
 */
export async function clearTabConfigCache(): Promise<void> {
  memoryCache.clear();
  lastResolvedBusinessId = null;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(k => k.startsWith(TAB_CONFIG_API_CONFIG.CACHE_KEY_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nothing actionable — the TTL will age the entries out regardless.
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function TabConfigProvider({ children }: { children: React.ReactNode }) {
  const { selectedBusiness, selectedModule } = useAppContext();

  // Seed synchronously from the memory mirror so a remount within this process
  // (portal switch, Auth → OwnerTabs) paints the resolved config immediately.
  // Lazy initialiser: reads the module-level mirror once at mount, not per render.
  const [seed] = useState(() => {
    const entry = readMemoryCache(lastResolvedBusinessId);
    return entry && lastResolvedBusinessId != null
      ? { snapshot: entry.snapshot, businessId: lastResolvedBusinessId }
      : null;
  });

  const [snapshot, setSnapshot] = useState<TabConfigSnapshot>(
    seed?.snapshot ?? UNRESOLVED_SNAPSHOT,
  );
  const [businessId, setBusinessId] = useState<number | null>(seed?.businessId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(Boolean(seed));

  const inFlightBizIdRef = useRef<number | null>(null);
  /**
   * Monotonic request counter. A response writes state only if its seq is still
   * current — covers A → B → A switching, where an id-equality check alone
   * would let the first A response overwrite the second.
   */
  const requestSeqRef = useRef(0);
  const lastFetchedAtRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const isCurrent = () => mountedRef.current && requestSeqRef.current === seq;

    // Resolve via findBusiness, NOT useModuleService.getSelectedBusinessId —
    // only findBusiness falls back to `b.name` when a cached record has no
    // `businessName`. With the other resolver a name-only record yields null,
    // the config never loads, and the gated groups stay hidden permanently.
    const business = await findBusiness(selectedModule, selectedBusiness);
    const bizId = (business?.id as number | undefined) ?? null;
    if (!isCurrent()) return;

    setBusinessId(bizId);

    if (bizId == null) {
      setSnapshot(UNRESOLVED_SNAPSHOT);
      setLoading(false);
      setError(null);
      setResolved(true);
      return;
    }

    const cached = await readCache(bizId);
    if (!isCurrent()) return;

    if (cached) {
      lastResolvedBusinessId = bizId;
      setSnapshot(cached.snapshot);
      setLoading(false);
      setResolved(true);
    } else {
      setLoading(true);
    }

    // Dedupe a concurrent fetch already running for this same business.
    if (inFlightBizIdRef.current === bizId) return;
    inFlightBizIdRef.current = bizId;

    try {
      const res = await tabConfigService.getTabConfig(bizId);
      if (!isCurrent()) return;

      if (res.success && res.data) {
        const next = normalizeTabConfig(res.data);
        lastResolvedBusinessId = bizId;
        lastFetchedAtRef.current = Date.now();
        setSnapshot(next);
        setError(null);
        setResolved(true);
        await writeCache(bizId, next);
      } else {
        // Leave the snapshot alone: cold stays fail-closed, warm keeps last-good.
        setError(res.error || 'Failed to load tab config');
      }
    } catch (e) {
      if (isCurrent()) {
        setError((e as Error)?.message || 'Failed to load tab config');
      }
    } finally {
      if (inFlightBizIdRef.current === bizId) inFlightBizIdRef.current = null;
      if (isCurrent()) setLoading(false);
    }
  }, [selectedBusiness, selectedModule]);

  // Mount + business switch. Replaces web's `centrix:business-change` event —
  // BusinessSheetOverlay sets module and business in one handler, so React
  // batches them into a single render with both new values.
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Foreground refresh. A web tab gets reloaded constantly; this app can sit in
  // the background for days, so without this an owner's web-side toggle would
  // never reach the phone. TTL-guarded so app-switching doesn't hammer the API.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (Date.now() - lastFetchedAtRef.current < TAB_CONFIG_API_CONFIG.CACHE_TTL_MS) return;
      refetch();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refetch]);

  const value = useMemo<TabConfigContextValue>(
    () => ({
      ...snapshot,
      businessId,
      loading,
      error,
      resolved,
      refetch,
      isAlwaysOn: (tabKey: string) => ALWAYS_ON_SET.has(tabKey),
    }),
    [snapshot, businessId, loading, error, resolved, refetch],
  );

  return <TabConfigContext.Provider value={value}>{children}</TabConfigContext.Provider>;
}
