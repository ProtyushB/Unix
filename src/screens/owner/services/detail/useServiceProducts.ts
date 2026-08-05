import { useCallback, useEffect, useRef, useState } from 'react';
import { toProductOptions, type ProductOption } from './serviceDetail.model';

/** One page. See `loadProductOptions` for why the picker does not page. */
const PAGE_SIZE = 500;

interface OptionsResult {
  success: boolean;
  data?: unknown[];
  totalPages?: number;
  error?: string | null;
}

/**
 * The business's products, for the Required Products picker.
 *
 * `enabled` is decided by `shouldLoadProductOptions`, which is pure and tested — this hook only
 * plumbs it. It flips false→true in read mode the moment a record with required products arrives,
 * so the fetch is guarded by a ref rather than by `enabled` alone, or the effect would re-run.
 */
export function useServiceProducts(
  loadProductOptions: (limit?: number) => Promise<OptionsResult>,
  enabled: boolean,
) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const didFetch = useRef(false);

  const fetchOptions = useCallback(async () => {
    didFetch.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await loadProductOptions(PAGE_SIZE);
      if (result.success) {
        setOptions(toProductOptions(result.data));
        setTruncated((result.totalPages ?? 1) > 1);
      } else {
        setError(result.error || 'Could not load products.');
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, [loadProductOptions]);

  useEffect(() => {
    if (!enabled || didFetch.current) return;
    void fetchOptions();
  }, [enabled, fetchOptions]);

  const reload = useCallback(() => {
    didFetch.current = false;
    void fetchOptions();
  }, [fetchOptions]);

  return { options, loading, error, truncated, reload };
}
