/**
 * Whether a detail screen offers a customer at all.
 *
 * Two rules, shared by the bill, order and appointment screens so they cannot drift apart, and kept
 * here rather than inline in the three `*Base.tsx` files so the repo's plain-node jest can cover
 * them — the same split `catalogPicker.view.ts` and `poolStock.ts` already use.
 *
 * The rules exist because a business can switch the Customers module off. That is a statement that
 * it does not track customers, not merely that a tab is hidden: with the module off there is no
 * directory to pick from and no walk-in form to fill, so every record is anonymous. Offering a
 * "Select customer" control anyway was worse than useless — it was REQUIRED, and the tab it points
 * at is gone, so a Customers-off business could not save a bill, an order or an appointment at all.
 */

/**
 * Does the Customer card render?
 *
 * Hidden only when the module is off AND this record has nobody on it. A record that already carries
 * a customer — booked before the module was switched off, or created on another client — still shows
 * them. Hiding a fact is not the same as removing a choice, and a bill that silently stopped naming
 * its customer would read as data loss.
 */
export function showsCustomerCard(customersEnabled: boolean, hasCustomer: boolean): boolean {
  return customersEnabled || hasCustomer;
}

/**
 * Can the picker be opened?
 *
 * Needs both an editable screen and the module. With the module off the card may still render (see
 * above), but read-only: there is nothing to pick from, so a tappable row would open an empty sheet.
 */
export function customerPickable(editable: boolean, customersEnabled: boolean): boolean {
  return editable && customersEnabled;
}
