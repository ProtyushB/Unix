/**
 * Dashboard API Implementation
 *
 * The dashboard aggregates live under the SAME /businesses base + host as the
 * read-only Customers endpoint, so we ride the shared person axios instance
 * (base URL + JWT attach + 401 refresh are already installed there) instead of
 * standing up a module-scoped client. Mirrors the Centrix web client.
 *
 * No timezone is sent: the backend buckets every window in Asia/Kolkata and no
 * longer reads a `tz` param.
 */

import personApiClient from '../../person/config/axios.instance';
import {
  DashboardApiInterface,
  type DashboardSummary,
  type RevenuePeriod,
  type RevenueSeries,
} from './dashboard.api.interface';
import type { ApiResponse } from '../../auth/api/auth.api.interface';

export class DashboardApiImpl extends DashboardApiInterface {
  async getSummary(businessId: number | string): Promise<ApiResponse<DashboardSummary>> {
    const response = await personApiClient.get(`/businesses/${businessId}/dashboard/summary`);
    return response.data;
  }

  async getRevenueSeries(
    businessId: number | string,
    period: RevenuePeriod = 'week',
  ): Promise<ApiResponse<RevenueSeries>> {
    const response = await personApiClient.get(
      `/businesses/${businessId}/dashboard/revenue-series`,
      { params: { period } },
    );
    return response.data;
  }
}
