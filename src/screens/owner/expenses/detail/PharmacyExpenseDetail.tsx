import type { ExpenseDetailSlots } from './ExpenseDetailBase';
import { moduleLabel } from './expenseDetail.modules';

/** Pharmacy's slots. Mirror of `ParlourExpenseDetail` — see that file for the reasoning. */
export function pharmacyExpenseSlots(): ExpenseDetailSlots {
  return { moduleLabel: moduleLabel('PHARMACY') };
}
