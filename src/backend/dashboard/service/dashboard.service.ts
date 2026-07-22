/**
 * Dashboard Service
 * Business logic layer for the owner-portal dashboard aggregates.
 */

import { AxiosError } from 'axios';
import { getDashboardApi } from '../provider/dashboard.provider';
import type {
  DashboardApiInterface,
  DashboardSummary,
  RevenuePeriod,
  RevenueSeries,
} from '../api/dashboard.api.interface';

interface ServiceResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  /** Coarse code shown on the dashboard error card, e.g. "ERR_NETWORK · 503". */
  code: string | null;
}

function toResult<T>(err: unknown): ServiceResult<T> {
  const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
  const status = axiosErr.response?.status;
  const kind = status ? 'ERR_BAD_RESPONSE' : (axiosErr.code || 'ERR_NETWORK');

  return {
    success: false,
    data: null,
    error:
      axiosErr.response?.data?.error ||
      axiosErr.response?.data?.message ||
      axiosErr.message ||
      'Failed to load dashboard',
    code: status ? `${kind} · ${status}` : kind,
  };
}

export class DashboardService {
  private api: DashboardApiInterface;

  constructor() {
    this.api = getDashboardApi();
  }

  async getSummary(businessId: number | string): Promise<ServiceResult<DashboardSummary>> {
    try {
      const response = await this.api.getSummary(businessId);
      if (response.success && response.data) {
        return { success: true, data: response.data, error: null, code: null };
      }
      return {
        success: false,
        data: null,
        error: response.error || response.message || 'Failed to load dashboard',
        code: 'ERR_BAD_REQUEST',
      };
    } catch (err) {
      return toResult<DashboardSummary>(err);
    }
  }

  async getRevenueSeries(
    businessId: number | string,
    period: RevenuePeriod = 'week',
  ): Promise<ServiceResult<RevenueSeries>> {
    try {
      const response = await this.api.getRevenueSeries(businessId, period);
      if (response.success && response.data) {
        return { success: true, data: response.data, error: null, code: null };
      }
      return {
        success: false,
        data: null,
        error: response.error || response.message || 'Failed to load revenue series',
        code: 'ERR_BAD_REQUEST',
      };
    } catch (err) {
      return toResult<RevenueSeries>(err);
    }
  }
}

export type { ServiceResult as DashboardServiceResult };
