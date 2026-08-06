/**
 * Per-module configuration for the Order Detail screen.
 *
 * There is very little of it, and that is the finding rather than an omission. The Pencil set's own
 * subtitle says "Parlour & pharmacy orders are identical (only the 'New Parlour/Pharmacy Order'
 * add-mode label differs)", and the backend agrees: `ParlourOrderDto` and `PharmacyOrderDto` are
 * field-for-field the same, both concrete entities add zero columns to the shared `Order`
 * `@MappedSuperclass`, and the two service impls diff to comments and import order.
 *
 * Contrast `productDetail.modules.ts`, where the two modules genuinely diverge (dispensing, Rx/OTC,
 * expiry) and `extraFields` carries real weight. Here there are no extra fields at all — so this
 * file exists to say so in one place, rather than leaving the next person to re-derive it.
 *
 * A `.ts` and not inline in the wrapper `.tsx` for the usual reason: jest's `testMatch` is
 * `*.test.ts`, so a decision made in a `.tsx` is a decision nobody can test.
 */

export type OrderModuleKey = 'PARLOUR' | 'PHARMACY';

export interface OrderModuleConfig {
  moduleKey: OrderModuleKey;
  /** The chip beside "New Order" in add mode. The only visible difference between the two. */
  moduleLabel: string;
  /** Sub-line on the products picker: "New order · Parlour". */
  pickerSubtitle: string;
  /** Empty for both modules today — see the note at the top of this file. */
  extraFields: readonly string[];
}

export const PARLOUR_ORDER_CONFIG: OrderModuleConfig = {
  moduleKey: 'PARLOUR',
  moduleLabel: 'Parlour',
  pickerSubtitle: 'New order · Parlour',
  extraFields: [],
};

export const PHARMACY_ORDER_CONFIG: OrderModuleConfig = {
  moduleKey: 'PHARMACY',
  moduleLabel: 'Pharmacy',
  pickerSubtitle: 'New order · Pharmacy',
  extraFields: [],
};

export function configFor(key: OrderModuleKey): OrderModuleConfig {
  return key === 'PHARMACY' ? PHARMACY_ORDER_CONFIG : PARLOUR_ORDER_CONFIG;
}
