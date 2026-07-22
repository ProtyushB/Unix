/**
 * Profile Sync
 *
 * Re-fetches the logged-in person's profile and rebuilds the cached
 * business-type map. LoginScreen and ReviewScreen do this inline at sign-in;
 * this pulls the same sequence out so long-lived sessions can refresh it —
 * notably the dashboard's "Refresh Status" on the Activation Pending panel,
 * which is otherwise reading a business record that was cached at login and
 * can never flip to verified.
 */

import { getLoggedInUser } from '../../../storage/auth.storage';
import {
  setUserProfile,
  setBusinessTypeMap,
  type Business,
  type BusinessTypeMap,
} from '../../../storage/session.storage';
import { getPersonService } from '../provider/person.provider';

export async function refreshBusinessProfile(): Promise<BusinessTypeMap | null> {
  try {
    const user = await getLoggedInUser();
    if (!user?.username) return null;

    const result = await getPersonService().getPersonByUsername(user.username);
    if (!result.success || !result.data) return null;

    const profile = result.data as Record<string, unknown>;
    await setUserProfile(profile);

    const businesses = (profile.business as Business[] | undefined) ?? [];
    if (businesses.length === 0) return null;

    const typeMap: BusinessTypeMap = {};
    businesses.forEach(biz => {
      const type = biz.businessType || 'CUSTOM';
      if (!typeMap[type]) typeMap[type] = [];
      typeMap[type].push(biz);
    });

    await setBusinessTypeMap(typeMap);
    return typeMap;
  } catch {
    // Offline or transient failure — callers fall back to the cached map.
    return null;
  }
}
