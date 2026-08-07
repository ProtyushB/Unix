import type { ModuleKey } from '../../products/detail/productDetail.modules';

/**
 * What differs between parlour and pharmacy batches.
 *
 * The honest answer today is: the app-bar label, and nothing else. `InventoryDto` is one class and
 * `ParlourInventoryDto` / `PharmacyInventoryDto` are empty subclasses of it, so unlike products —
 * where pharmacy adds prescription fields the parlour has never heard of — there is no divergence
 * to model.
 *
 * This file exists anyway, for the reason its order sibling does: "there is no divergence" is a
 * claim worth stating in ONE testable place. Written as a lookup in a screen it would be invisible;
 * written here, a test fails the day someone adds a pharmacy-only batch field without also adding
 * it to the form.
 */

export interface BatchModuleConfig {
  moduleKey: ModuleKey;
  /** The pill beside "Add Batch", and the word used in the app-bar subtitle. */
  label: string;
  /**
   * Fields this module adds to the batch form beyond the shared set.
   *
   * Empty for both today. Kept as a declared, tested slot so the first module-specific field has an
   * obvious home rather than being wedged into the base component behind an `if`.
   */
  extraFields: readonly string[];
}

const PARLOUR: BatchModuleConfig = {
  moduleKey: 'PARLOUR',
  label: 'Parlour',
  extraFields: [],
};

const PHARMACY: BatchModuleConfig = {
  moduleKey: 'PHARMACY',
  label: 'Pharmacy',
  extraFields: [],
};

/**
 * Falls back to parlour for anything unrecognised, matching every sibling `configFor`.
 *
 * A batch screen that renders SOMETHING for an unknown module beats one that crashes — the module
 * key arrives from stored session state, which can be stale after a business switch.
 */
export function configFor(moduleKey: string | null | undefined): BatchModuleConfig {
  return String(moduleKey ?? '').toUpperCase() === 'PHARMACY' ? PHARMACY : PARLOUR;
}

/** "Parlour" / "Pharmacy" — the module pill in the app bar. */
export function moduleLabel(moduleKey: string | null | undefined): string {
  return configFor(moduleKey).label;
}
