import { useContext } from 'react';
import {
  TabConfigContext,
  type TabConfigContextValue,
} from '../provider/tab-config.provider';

/**
 * Read the per-business tab config.
 *
 * Outside a TabConfigProvider this returns the FAIL-CLOSED default (release-gated
 * tabs hidden), unlike the web hook which returns an all-on stub for test
 * convenience. A mis-mounted provider here should hide too much, never too little.
 */
export function useTabConfig(): TabConfigContextValue {
  return useContext(TabConfigContext);
}
