import { useTabConfig } from './useTabConfig';
import { ALWAYS_ON_TABS, type TabKey } from '../config/api.config';

const ALWAYS_ON_SET = new Set<string>(ALWAYS_ON_TABS);

/**
 * True if the given tab key is enabled for the current business. Always-on tabs
 * return true unconditionally, as defence-in-depth against a misbehaving server.
 *
 * Note the asymmetry with the navbar filter, carried over from web: this requires
 * an explicit `true`, while `filterNavGroupsByTabs` only hides on an explicit
 * `false`. A key missing from the payload is visible in the navbar but disabled
 * as a feature gate.
 */
export function useIsTabEnabled(tabKey: TabKey): boolean {
  const { tabs } = useTabConfig();
  if (ALWAYS_ON_SET.has(tabKey)) return true;
  return tabs?.[tabKey] === true;
}
