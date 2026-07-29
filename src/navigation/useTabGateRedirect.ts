import { useEffect } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTabConfig } from '../backend/tab-config';
import { findItemByTabName } from './navGroups';

/**
 * Bounce off a tab that the business has switched off.
 *
 * Port of the redirect effect in `Centrix/src/pages/OwnerPortal.jsx`. Screens
 * stay mounted whether or not their tab is enabled — same as web, where the
 * route still resolves and then redirects — so this is what stops a user being
 * stranded on a screen that just lost its navbar entry.
 *
 * Gates on `resolved` rather than `loading`: the mobile business-id lookup is
 * async, so there is a window where loading is false but the config is still the
 * fail-closed default, and redirecting off that would be wrong.
 *
 * Dashboard is always a safe target — `forceAlwaysOn` pins DASHBOARD true no
 * matter what the server sends.
 */
export function useTabGateRedirect(
  state: BottomTabBarProps['state'],
  navigation: BottomTabBarProps['navigation'],
): void {
  const { tabs, resolved } = useTabConfig();
  const activeTabName = state.routes[state.index].name;

  useEffect(() => {
    if (!resolved || !tabs) return;
    // Account has no tabKey and can never be gated (web skips Settings/Account
    // for the same reason); bailing early keeps the intent explicit.
    if (activeTabName === 'Account') return;

    const item = findItemByTabName(activeTabName);
    if (item?.tabKey && tabs[item.tabKey] === false) {
      navigation.navigate('Dashboard' as never);
    }
    // Keyed on the route NAME, not `state`, so unrelated navigation churn
    // doesn't re-run this.
  }, [tabs, resolved, activeTabName, navigation]);
}
