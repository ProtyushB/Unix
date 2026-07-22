import { useCallback, useState } from 'react';
import { getDashboardService } from '../provider/dashboard.provider';
import type { DashboardSummary } from '../api/dashboard.api.interface';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseDashboardResult {
  summary: DashboardSummary | null;
  loading: boolean;
  /** Human-readable failure message; null while healthy. */
  error: string | null;
  /** Coarse failure code for the error card, e.g. "ERR_NETWORK · 503". */
  errorCode: string | null;
  /** Timestamp of the last SUCCESSFUL load — drives "Last synced HH:MM". */
  lastSyncedAt: Date | null;
  reload: (businessId: number | string | null) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): UseDashboardResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const reload = useCallback(async (businessId: number | string | null) => {
    if (!businessId) {
      setSummary(null);
      setError(null);
      setErrorCode(null);
      return;
    }

    setLoading(true);
    const result = await getDashboardService().getSummary(businessId);

    if (result.success && result.data) {
      setSummary(result.data);
      setError(null);
      setErrorCode(null);
      setLastSyncedAt(new Date());
    } else {
      // Keep the previous summary on screen — the error banner tells the user
      // the numbers are stale rather than blanking them out.
      setError(result.error);
      setErrorCode(result.code);
    }
    setLoading(false);
  }, []);

  return { summary, loading, error, errorCode, lastSyncedAt, reload };
}
