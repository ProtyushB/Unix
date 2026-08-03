/**
 * Dashboard Module - Public API
 */

export { useDashboard } from './hook/useDashboard';
export type { UseDashboardResult } from './hook/useDashboard';
export { DashboardService } from './service/dashboard.service';
export {
  getDashboardService,
  setDashboardApi,
  resetDashboardApi,
} from './provider/dashboard.provider';
export type {
  DashboardMetric,
  DashboardStats,
  DashboardSummary,
  TopService,
  RevenuePeriod,
  RevenueSeries,
  RevenueSeriesPoint,
} from './api/dashboard.api.interface';
