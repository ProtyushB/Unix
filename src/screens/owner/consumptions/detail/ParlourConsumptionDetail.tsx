import type { ConsumptionDetailSlots } from './ConsumptionDetailBase';
import { moduleLabel } from './consumptionDetail.modules';

/**
 * Parlour's slots for the Consumption Detail screen.
 *
 * A plain function, not a component — there is nothing to render, only data the base uses. Every
 * decision about what differs per module lives in `consumptionDetail.modules.ts`, because that file
 * is a `.ts` and therefore testable under this repo's jest config; a `.tsx` never is.
 *
 * Today the only divergence is the app-bar pill, which is why this is three lines. It exists so the
 * first real difference has an obvious home rather than an `if (module === …)` in the base.
 */
export function parlourConsumptionSlots(): ConsumptionDetailSlots {
  return { moduleLabel: moduleLabel('PARLOUR') };
}
