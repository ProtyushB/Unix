/**
 * Dashboard API Interface
 *
 * Contract for the business-portal dashboard aggregates. Ported from the
 * Centrix web client (`src/backend/dashboard/dashboardApi.js`).
 *
 * IMPORTANT: This file must NEVER import anything except type definitions.
 */

import type { ApiResponse } from '../../auth/api/auth.api.interface';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One KPI card. `changePct` is null when there is no prior period to compare
 * against (the web client renders "New" in that case; the mobile stat card
 * renders "No change").
 */
export interface DashboardMetric {
  value: number;
  changePct: number | null;
  trendUp: boolean;
}

export interface DashboardStats {
  todaysRevenue: DashboardMetric;
  todaysOrders: DashboardMetric;
  todaysAppointments: DashboardMetric;
  todaysActiveCustomers: DashboardMetric;
}

export interface TopService {
  serviceId?: number;
  serviceName: string;
  bookings: number;
  revenue: number;
}

export type RevenuePeriod = 'week' | 'month' | 'year';

export interface RevenueSeriesPoint {
  label: string;
  amount: number;
}

export interface RevenueSeries {
  period: RevenuePeriod;
  points: RevenueSeriesPoint[];
}

export interface DashboardSummary {
  stats: DashboardStats;
  topServices?: TopService[];
  revenueSeries?: RevenueSeries;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export abstract class DashboardApiInterface {
  /** First-paint payload: KPI cards + top services + default (week) revenue series. */
  abstract getSummary(businessId: number | string): Promise<ApiResponse<DashboardSummary>>;

  /** Revenue series for the chart's week/month/year toggle. */
  abstract getRevenueSeries(
    businessId: number | string,
    period?: RevenuePeriod,
  ): Promise<ApiResponse<RevenueSeries>>;
}
