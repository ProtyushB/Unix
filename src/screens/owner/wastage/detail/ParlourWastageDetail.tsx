import type { WastageDetailSlots } from './WastageDetailBase';
import { moduleLabel } from './wastageDetail.modules';

/**
 * Parlour's slots for the Wastage Detail screen.
 *
 * A plain function, not a component — there is nothing to render, only data the base uses. Every
 * decision about what differs per module lives in `wastageDetail.modules.ts`, because that file is
 * a `.ts` and therefore testable under this repo's jest config; a `.tsx` never is.
 *
 * Today the only divergence is the app-bar pill, which is why this is three lines. It exists so the
 * first real difference has an obvious home rather than an `if (module === …)` in the base.
 */
export function parlourWastageSlots(): WastageDetailSlots {
  return { moduleLabel: moduleLabel('PARLOUR') };
}
