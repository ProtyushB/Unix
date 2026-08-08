import type { ModuleKey } from '../../products/detail/productDetail.modules';

/**
 * What differs between parlour and pharmacy wastage.
 *
 * The honest answer today is: the app-bar label, and nothing else. The two controllers are
 * byte-identical apart from their base path and the DTO is one class, so unlike products — where
 * pharmacy adds prescription fields the parlour has never heard of — there is no divergence to
 * model.
 *
 * This file exists anyway, for the reason its batch sibling does: "there is no divergence" is a
 * claim worth stating in ONE testable place. Written as a lookup in a screen it would be invisible;
 * written here, a test fails the day someone adds a pharmacy-only field without also adding it to
 * the form. (Wastage is the likeliest of the three to grow one — a controlled-substance write-off
 * carries obligations a salon's does not.)
 */

export interface WastageModuleConfig {
  moduleKey: ModuleKey;
  /** The pill beside the app-bar title, and the word used in the subtitle. */
  label: string;
  /**
   * Fields this module adds to the form beyond the shared set.
   *
   * Empty for both today. Kept as a declared, tested slot so the first module-specific field has an
   * obvious home rather than being wedged into the base component behind an `if`.
   */
  extraFields: readonly string[];
}

const PARLOUR: WastageModuleConfig = {
  moduleKey: 'PARLOUR',
  label: 'Parlour',
  extraFields: [],
};

const PHARMACY: WastageModuleConfig = {
  moduleKey: 'PHARMACY',
  label: 'Pharmacy',
  extraFields: [],
};

/**
 * Falls back to parlour for anything unrecognised, matching every sibling `configFor`.
 *
 * A screen that renders SOMETHING for an unknown module beats one that crashes — the module key
 * arrives from stored session state, which can be stale after a business switch.
 */
export function configFor(moduleKey: string | null | undefined): WastageModuleConfig {
  return String(moduleKey ?? '').toUpperCase() === 'PHARMACY' ? PHARMACY : PARLOUR;
}

/** "Parlour" / "Pharmacy" — the module pill in the app bar. */
export function moduleLabel(moduleKey: string | null | undefined): string {
  return configFor(moduleKey).label;
}
