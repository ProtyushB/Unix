import type { BatchDetailSlots } from './BatchDetailBase';
import { moduleLabel } from './batchDetail.modules';

/** Pharmacy's slots. See `ParlourBatchDetail` for why these are functions rather than components. */
export function pharmacyBatchSlots(): BatchDetailSlots {
  return { moduleLabel: moduleLabel('PHARMACY') };
}
