import type { ConsumptionDetailSlots } from './ConsumptionDetailBase';
import { moduleLabel } from './consumptionDetail.modules';

/** Pharmacy's slots. See `ParlourConsumptionDetail` for why these are functions, not components. */
export function pharmacyConsumptionSlots(): ConsumptionDetailSlots {
  return { moduleLabel: moduleLabel('PHARMACY') };
}
