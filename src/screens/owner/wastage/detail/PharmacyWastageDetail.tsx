import type { WastageDetailSlots } from './WastageDetailBase';
import { moduleLabel } from './wastageDetail.modules';

/** Pharmacy's slots. See `ParlourWastageDetail` for why these are functions, not components. */
export function pharmacyWastageSlots(): WastageDetailSlots {
  return { moduleLabel: moduleLabel('PHARMACY') };
}
