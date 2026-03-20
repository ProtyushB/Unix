// ─── Business Type Constants ─────────────────────────────────────────────────

export const PARLOUR = 'PARLOUR';
export const PHARMACY = 'PHARMACY';
export const RESTAURANT = 'RESTAURANT';
export const ELECTRONICS = 'ELECTRONICS';
export const GYM = 'GYM';
export const RETAIL = 'RETAIL';
export const FASHION = 'FASHION';
export const CUSTOM = 'CUSTOM';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BusinessTypeOption {
  value: string;
  label: string;
}

// ─── Business Types Array ────────────────────────────────────────────────────

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { value: PARLOUR, label: 'Parlour' },
  { value: PHARMACY, label: 'Pharmacy' },
  { value: RESTAURANT, label: 'Restaurant' },
  { value: ELECTRONICS, label: 'Electronics' },
  { value: GYM, label: 'Gym' },
  { value: RETAIL, label: 'Retail' },
  { value: FASHION, label: 'Fashion' },
  { value: CUSTOM, label: 'Custom' },
];

// ─── Lookup Map (built once) ─────────────────────────────────────────────────

const TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BUSINESS_TYPES.map(bt => [bt.value, bt.label]),
);

// ─── Helper ──────────────────────────────────────────────────────────────────

export function getBusinessTypeLabel(type: string): string {
  return TYPE_LABEL_MAP[type] ?? type;
}
