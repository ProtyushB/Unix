/**
 * Dashboard API Implementation
 *
 * The dashboard aggregates live under the SAME /businesses base + host as the
 * read-only Customers endpoint, so we ride the shared person axios instance
 * (base URL + JWT attach + 401 refresh are already installed there) instead of
 * standing up a module-scoped client. Mirrors the Centrix web client.
 *
 * `tz` is the viewer's IANA timezone; the backend uses it to compute
 * today/week/month boundaries and chart buckets. Hermes does not reliably
 * expose `Intl.DateTimeFormat().resolvedOptions()`, and the product's wall
 * clock is IST throughout, so it is fixed to Asia/Kolkata.
 */

import personApiClient from '../../person/config/axios.instance';
import {
  DashboardApiInterface,
  type DashboardSummary,
  type RevenuePeriod,
  type RevenueSeries,
} from './dashboard.api.interface';
import type { ApiResponse } from '../../auth/api/auth.api.interface';

const TZ = 'Asia/Kolkata';

export class DashboardApiImpl extends DashboardApiInterface {
  async getSummary(businessId: number | string): Promise<ApiResponse<DashboardSummary>> {
    const response = await personApiClient.get(`/businesses/${businessId}/dashboard/summary`, {
      params: { tz: TZ },
    });
    return response.data;
  }

  async getRevenueSeries(
    businessId: number | string,
    period: RevenuePeriod = 'week',
  ): Promise<ApiResponse<RevenueSeries>> {
    const response = await personApiClient.get(
      `/businesses/${businessId}/dashboard/revenue-series`,
      { params: { period, tz: TZ } },
    );
    return response.data;
  }
}
