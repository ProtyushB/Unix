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

// Derives which portals a user has access to, in fixed order
export function getAvailablePortals(user: any): PortalKey[] {
  const roles: string[] = user?.roles ?? [];
  const types: string[] = user?.types ?? [];

  const hasBusiness =
    types.includes('BUSINESS_OWNER') ||
    roles.includes('BUSINESS_OWNER') ||
    roles.includes('ROLE_OWNER') ||
    roles.includes('ROLE_ADMIN');

  const available: PortalKey[] = ['customer'];
  if (hasBusiness) available.push('business');
  return available;
}
