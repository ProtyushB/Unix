import {
  Scissors,
  Pill,
  UtensilsCrossed,
  Cpu,
  Dumbbell,
  Store,
  Shirt,
  Building2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

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
  BUSINESS_TYPES.map((bt) => [bt.value, bt.label]),
);

// ─── Helper ──────────────────────────────────────────────────────────────────

export function getBusinessTypeLabel(type: string): string {
  return TYPE_LABEL_MAP[type] ?? type;
}

// ─── Icon Map ────────────────────────────────────────────────────────────────
// Drives the accent logo chip in the dashboard's business switcher.

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  [PARLOUR]: Scissors,
  [PHARMACY]: Pill,
  [RESTAURANT]: UtensilsCrossed,
  [ELECTRONICS]: Cpu,
  [GYM]: Dumbbell,
  [RETAIL]: Store,
  [FASHION]: Shirt,
  [CUSTOM]: Building2,
};

export function getBusinessTypeIcon(type: string | null | undefined): LucideIcon {
  if (!type) return Building2;
  return TYPE_ICON_MAP[type.toUpperCase()] ?? Building2;
}
