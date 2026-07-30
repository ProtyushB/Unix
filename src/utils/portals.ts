/**
 * Customer portal kill switch.
 *
 * OFF until the customer portal is actually worked on. Nothing is deleted — every
 * screen, navigator and route stays compiled and registered, so turning this back
 * to `true` restores the feature with no other edit.
 *
 * This is the single lever. Every route into the customer portal consults it:
 * RootNavigator's cold-start decision, LoginScreen.navigateToPortal,
 * PortalSelectionScreen, and getAvailablePortals below (which is what empties the
 * portal switcher and hides the dropdown on the profile card).
 *
 * ⚠️ While this is false the app is business-only, so an account with NO business
 * access lands in the owner portal rather than a customer one. That is the
 * intended trade for now — there is nowhere else to send them — but it means
 * customer-only accounts are effectively unsupported until this flips back.
 */
export const CUSTOMER_PORTAL_ENABLED = false;

export const PORTALS = {
  customer: {
    key: 'customer' as const,
    label: 'Customer',
    route: 'CustomerTabs' as const,
  },
  business: {
    key: 'business' as const,
    label: 'Business',
    route: 'OwnerTabs' as const,
  },
} as const;

export type PortalKey = keyof typeof PORTALS;

// Fixed display order — never reorders based on active selection
export const PORTAL_ORDER: PortalKey[] = ['customer', 'business'];

// Single source of truth for "does this user have business/owner access?"
// Primary signal: person profile types (BUSINESS_OWNER, EMPLOYEE)
// Fallback: auth roles in case backend format differs
export function isBusinessUser(roles: string[], types: string[] = []): boolean {
  return (
    types.includes('BUSINESS_OWNER') ||
    types.includes('EMPLOYEE') ||
    roles.includes('BUSINESS_OWNER') ||
    roles.includes('EMPLOYEE')
  );
}

// Derives which portals a user has access to, in fixed order
export function getAvailablePortals(user: any): PortalKey[] {
  // Kill switch: offering only one portal is what makes the switcher sheet empty
  // and the profile-card dropdown disappear, since both are gated on there being
  // more than one portal to choose from.
  if (!CUSTOMER_PORTAL_ENABLED) return ['business'];

  const roles: string[] = user?.roles ?? [];
  const types: string[] = user?.types ?? [];
  const available: PortalKey[] = ['customer'];
  if (isBusinessUser(roles, types)) available.push('business');
  return available;
}
