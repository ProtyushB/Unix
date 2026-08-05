/**
 * The parlour and pharmacy bindings for the Service Detail screen.
 *
 * These live in a `.ts` rather than inside the wrapper components, unlike the web portal which
 * keeps them inline in JSX. The two things worth testing about a module binding are its field list
 * and its validation, both of which are pure — and `jest.config.js` matches `*.test.ts` only, so
 * anything defined in a `.tsx` is untestable here by construction.
 *
 * A wrapper therefore supplies only JSX; every decision lives in the config.
 */

import type { ServiceFormState } from './serviceDetail.model';
import type { ValidationErrors } from './serviceDetail.view';

export type ModuleKey = 'PARLOUR' | 'PHARMACY';

export interface ServiceModuleConfig {
  moduleKey: ModuleKey;
  /** Used in the app-bar subtitle: "Update this parlour service". */
  entityLabel: string;
  /**
   * The module's own DTO keys. Drives BOTH form seeding and the payload round-trip, so a field
   * added here is carried end to end without touching the generic layer.
   *
   * ⚠️ A key listed here becomes form state, and form state OVERWRITES the server value on save.
   * A field with no UI must therefore be left OUT, so it rides the `...serverItem` spread in
   * `toUpdatePayload` untouched instead of being written back as the `null` an unrendered form
   * field holds. That is why pharmacy's `requirements` is absent below, and why `categoryIds` is
   * absent from both.
   */
  extraFields: readonly string[];
  /** Applied in add mode only — the shape a brand-new record starts in. */
  extraDefaults: Record<string, unknown>;
  /** Module-specific rules, merged over the shared ones. Empty today for both. */
  validate(form: ServiceFormState): ValidationErrors;
}

/** The single field each module contributes to the Service Information card, beside the name. */
export function primaryFieldKey(config: ServiceModuleConfig): string {
  return config.moduleKey === 'PHARMACY' ? 'consultationType' : 'expertiseLevel';
}

export const PARLOUR_SERVICE_CONFIG: ServiceModuleConfig = {
  moduleKey: 'PARLOUR',
  entityLabel: 'parlour service',
  extraFields: ['expertiseLevel', 'serviceIncludes', 'toolsRequired'],
  extraDefaults: {
    expertiseLevel: '',
    serviceIncludes: '',
    toolsRequired: '',
  },
  validate: () => ({}),
};

/**
 * Pharmacy extras.
 *
 * `equipmentRequired` is what the service is performed WITH (BP monitor, cuff). The DTO also
 * carries `requirements` — what the CUSTOMER must bring (prescription, insurance card) — which has
 * no mobile UI and is deliberately not listed, so it round-trips untouched.
 */
export const PHARMACY_SERVICE_CONFIG: ServiceModuleConfig = {
  moduleKey: 'PHARMACY',
  entityLabel: 'pharmacy service',
  extraFields: ['consultationType', 'serviceIncludes', 'equipmentRequired'],
  extraDefaults: {
    consultationType: '',
    serviceIncludes: '',
    equipmentRequired: '',
  },
  validate: () => ({}),
};

export function configFor(moduleKey: string): ServiceModuleConfig {
  return moduleKey === 'PHARMACY' ? PHARMACY_SERVICE_CONFIG : PARLOUR_SERVICE_CONFIG;
}
