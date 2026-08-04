/**
 * The parlour and pharmacy bindings for the Product Detail screen.
 *
 * These live in a `.ts` rather than inside the wrapper components, unlike the web portal which
 * keeps them inline in JSX. The two things worth testing about a module binding are its field list
 * and its validation, both of which are pure — and `jest.config.js` matches `*.test.ts` only, so
 * anything defined in a `.tsx` is untestable here by construction.
 *
 * A wrapper therefore supplies only JSX; every decision lives in the config.
 */

import type { ProductFormState } from './productDetail.model';
import type { ValidationErrors } from './productDetail.view';

export type ModuleKey = 'PARLOUR' | 'PHARMACY';

export interface ProductModuleConfig {
  moduleKey: ModuleKey;
  /** Used in the app-bar subtitle: "Update this parlour product". */
  entityLabel: string;
  /**
   * The module's own DTO keys. Drives BOTH form seeding and the payload round-trip, so a field
   * added here is carried end to end without touching the generic layer.
   */
  extraFields: readonly string[];
  /** Applied in add mode only — the shape a brand-new record starts in. */
  extraDefaults: Record<string, unknown>;
  /** Module-specific rules, merged over the shared ones. Empty today for both. */
  validate(form: ProductFormState): ValidationErrors;
}

/**
 * Parlour extras. `isOrganic`/`isCrueltyFree` are independent booleans — a product can be both,
 * either or neither — which is why they render as two separate chips rather than a choice.
 */
export const PARLOUR_PRODUCT_CONFIG: ProductModuleConfig = {
  moduleKey: 'PARLOUR',
  entityLabel: 'parlour product',
  extraFields: [
    'skinType',
    'usage',
    'applicationMethod',
    'ingredients',
    'isOrganic',
    'isCrueltyFree',
  ],
  extraDefaults: {
    skinType: '',
    usage: '',
    applicationMethod: '',
    ingredients: '',
    isOrganic: false,
    isCrueltyFree: false,
  },
  validate: () => ({}),
};

/**
 * Pharmacy extras.
 *
 * `isPrescriptionRequired` and `isOTC` are two columns expressing ONE choice, and the UI writes
 * them as a mutually-exclusive pair. Left independent they can contradict each other — a product
 * marked both prescription-only and over-the-counter is not a state anyone can act on.
 */
export const PHARMACY_PRODUCT_CONFIG: ProductModuleConfig = {
  moduleKey: 'PHARMACY',
  entityLabel: 'pharmacy product',
  extraFields: [
    'genericName',
    'dosageForm',
    'strength',
    'routeOfAdministration',
    'storageConditions',
    'isPrescriptionRequired',
    'isOTC',
  ],
  extraDefaults: {
    genericName: '',
    dosageForm: '',
    strength: '',
    routeOfAdministration: '',
    storageConditions: '',
    // Over-the-counter is the safer default: it under-claims. Defaulting to prescription-required
    // would mark every new product Rx on a form where nobody chose that.
    isPrescriptionRequired: false,
    isOTC: true,
  },
  validate: (form) => {
    const errors: ValidationErrors = {};
    const rx = form.extras.isPrescriptionRequired === true;
    const otc = form.extras.isOTC === true;
    if (rx && otc) {
      errors.dispensing = 'A product cannot be both prescription-only and over the counter.';
    }
    return errors;
  },
};

export function configFor(moduleKey: string): ProductModuleConfig {
  return moduleKey === 'PHARMACY' ? PHARMACY_PRODUCT_CONFIG : PARLOUR_PRODUCT_CONFIG;
}

/** Flip the dispensing pair atomically — the only correct way to write two columns holding one choice. */
export function setDispensing(
  extras: Record<string, unknown>,
  prescriptionRequired: boolean,
): Record<string, unknown> {
  return { ...extras, isPrescriptionRequired: prescriptionRequired, isOTC: !prescriptionRequired };
}
