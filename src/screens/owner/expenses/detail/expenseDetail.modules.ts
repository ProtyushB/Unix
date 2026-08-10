/**
 * What differs between parlour and pharmacy on the Expense Detail screen.
 *
 * The answer today is: nothing but the label. An expense is a non-inventory outflow — it names no
 * product, touches no batch and reads no ladder — so the two module surfaces have nothing to
 * disagree about. The controllers are byte-identical apart from the base path and one Swagger
 * string.
 *
 * Stated in one testable place rather than left implicit, matching `wastageDetail.modules.ts`. When
 * a real divergence arrives it has an obvious home, and until then the emptiness is a claim someone
 * checked rather than an absence someone forgot.
 */

export type ModuleKey = 'PARLOUR' | 'PHARMACY';

export interface ExpenseModuleConfig {
  moduleKey: ModuleKey;
  /** The chip beside the form's title. */
  label: string;
  /**
   * Extra fields this module adds to the form. Empty for both — an explicitly declared empty slot,
   * not a missing feature.
   */
  extraFields: readonly string[];
}

const PARLOUR: ExpenseModuleConfig = {
  moduleKey: 'PARLOUR',
  label: 'Parlour',
  extraFields: [],
};

const PHARMACY: ExpenseModuleConfig = {
  moduleKey: 'PHARMACY',
  label: 'Pharmacy',
  extraFields: [],
};

/**
 * The config for a module key.
 *
 * Defaults to parlour on anything unrecognised rather than throwing: `selectedModule` comes from
 * app context and a detail screen must render even if it arrives blank mid-switch.
 */
export function configFor(moduleKey: string | null | undefined): ExpenseModuleConfig {
  return String(moduleKey ?? '').toUpperCase() === 'PHARMACY' ? PHARMACY : PARLOUR;
}

export function moduleLabel(moduleKey: string | null | undefined): string {
  return configFor(moduleKey).label;
}
