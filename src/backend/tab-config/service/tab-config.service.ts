/**
 * Tab Config Service
 *
 * Port of `Centrix/src/backend/tab-config/service/tab-config.service.js`.
 *
 * Deliberately flat — no api.interface / api.impl / DI-provider layering like
 * `business` and `dashboard` use. For a single read endpoint that indirection
 * buys nothing, and the web service is the shape being ported. If a mock seam is
 * ever needed, adding `api/` + a provider is mechanical.
 *
 * Rides `businessApiClient`, which is already based at PERSON_BASE_URL and
 * already attaches the JWT + handles the 401 refresh.
 */

import { AxiosError } from 'axios';
import businessApiClient from '../../business/config/axios.instance';
import { TAB_CONFIG_API_CONFIG } from '../config/api.config';
import type { TabMap } from '../config/api.config';
import type { TabConfigPayload } from '../util/tab-config.normalize';

export interface TabConfigServiceResult {
  success: boolean;
  data: TabConfigPayload | null;
  error: string | null;
}

function toError(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
  return (
    axiosErr.response?.data?.error ||
    axiosErr.response?.data?.message ||
    axiosErr.message ||
    fallback
  );
}

const tabConfigService = {
  async getTabConfig(businessId: number | string): Promise<TabConfigServiceResult> {
    try {
      const { data } = await businessApiClient.get(
        TAB_CONFIG_API_CONFIG.ENDPOINTS.TAB_CONFIG_BY_BUSINESS(businessId),
      );
      // Backend double-wraps: { success, message, data: { tabs, ... } }
      return { success: true, data: data?.data ?? null, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: toError(err, 'Failed to fetch tab config'),
      };
    }
  },

  /**
   * Kept for API parity with web. Nothing on mobile writes tab config today —
   * the owner toggles live in the Centrix web Settings panel.
   */
  async updateTabConfig(
    businessId: number | string,
    tabs: Partial<TabMap>,
  ): Promise<TabConfigServiceResult> {
    try {
      const { data } = await businessApiClient.put(
        TAB_CONFIG_API_CONFIG.ENDPOINTS.TAB_CONFIG_BY_BUSINESS(businessId),
        { tabs },
      );
      return { success: true, data: data?.data ?? null, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: toError(err, 'Failed to update tab config'),
      };
    }
  },
};

export default tabConfigService;
