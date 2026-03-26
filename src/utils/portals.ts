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
  const roles: string[] = user?.roles ?? [];
  const types: string[] = user?.types ?? [];
  const available: PortalKey[] = ['customer'];
  if (isBusinessUser(roles, types)) available.push('business');
  return available;
}
