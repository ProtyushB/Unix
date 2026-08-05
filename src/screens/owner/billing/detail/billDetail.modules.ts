/**
 * Per-module configuration for the Bill Detail screen.
 *
 * Thin, like the order and appointment screens' — parlour and pharmacy bills are the same record
 * with the same fields, and `ParlourBillServiceImpl` / `PharmacyBillServiceImpl` are line-for-line
 * siblings. What differs is which catalog the Quick Add tab lists, and that comes from whichever
 * module hook is active rather than from anything here.
 */

export type BillModuleKey = 'PARLOUR' | 'PHARMACY';

export interface BillModuleConfig {
  moduleKey: BillModuleKey;
  /** The chip beside "Create Bill" in add mode. The only visible difference between the two. */
  moduleLabel: string;
}

export const PARLOUR_BILL_CONFIG: BillModuleConfig = {
  moduleKey: 'PARLOUR',
  moduleLabel: 'Parlour',
};

export const PHARMACY_BILL_CONFIG: BillModuleConfig = {
  moduleKey: 'PHARMACY',
  moduleLabel: 'Pharmacy',
};

export function configFor(key: BillModuleKey): BillModuleConfig {
  return key === 'PHARMACY' ? PHARMACY_BILL_CONFIG : PARLOUR_BILL_CONFIG;
}
