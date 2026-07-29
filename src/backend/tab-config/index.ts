export {
  TabConfigProvider,
  TabConfigContext,
  clearTabConfigCache,
} from './provider/tab-config.provider';
export type { TabConfigContextValue } from './provider/tab-config.provider';
export { useTabConfig } from './hook/useTabConfig';
export { useIsTabEnabled } from './hook/useIsTabEnabled';
export { default as tabConfigService } from './service/tab-config.service';
export {
  TAB_CONFIG_API_CONFIG,
  ALWAYS_ON_TABS,
  DEFAULT_ALL_ON,
  DEFAULT_UNRESOLVED,
  RELEASE_GATED_TABS,
} from './config/api.config';
export type { TabKey, TabMap } from './config/api.config';
export { forceAlwaysOn, normalizeTabConfig, UNRESOLVED_SNAPSHOT } from './util/tab-config.normalize';
export type { TabConfigSnapshot, TabConfigPayload } from './util/tab-config.normalize';
