/**
 * Which tab the Add-items sheet opens on, and what its record lists say when they are empty.
 *
 * RN-free so the repo's plain-node jest can cover it, and because both decisions turn on one fact
 * the component cannot be trusted to infer: whether the bill HAS a customer. The types live here
 * rather than in `AddItemsSheet.tsx` for the same reason — importing them from the component would
 * drag React Native into the test.
 *
 * The orders/appointments picker is customer-scoped by design: everything billed together belongs
 * to one person, so the list is that person's unbilled records. A bill with nobody on it therefore
 * has nothing to show there, permanently — not "nothing yet".
 */

export type AddItemKind = 'ORDER' | 'APPOINTMENT' | 'PRODUCT' | 'SERVICE';

/**
 * The three item SOURCES. Distinct from {@link AddItemKind}, which names the four DATA lists —
 * Quick Add has no list, no source and nothing to fetch.
 */
export type TopTab = 'RECORDS' | 'CATALOG' | 'QUICK';

/**
 * Where the sheet opens.
 *
 * Records first when there is a customer, because attaching what they already ordered is the common
 * errand. With no customer that tab can never fill, so opening on it puts a dead end in front of the
 * seller before they have done anything — and for a business with the Customers module off, that is
 * every bill it will ever write. Catalog is the first tab that can actually take an item.
 */
export function openingTab(hasCustomer: boolean): { top: TopTab; kind: AddItemKind } {
  return hasCustomer ? { top: 'RECORDS', kind: 'ORDER' } : { top: 'CATALOG', kind: 'PRODUCT' };
}

/** The caption above a list. */
export function helperLine(kind: AddItemKind, hasCustomer: boolean): string {
  switch (kind) {
    case 'ORDER':
      return hasCustomer ? "This customer's unbilled orders" : 'Unbilled orders — needs a customer';
    case 'APPOINTMENT':
      return hasCustomer
        ? "This customer's unbilled appointments"
        : 'Unbilled appointments — needs a customer';
    case 'PRODUCT':
      return 'Catalog — added as a bare line, or via a new order';
    default:
      return 'Catalog — added as a bare line, or via a new appointment';
  }
}

/**
 * What an empty list says.
 *
 * `customerName || 'This customer'` was the whole rule, and it answered the wrong question: the
 * fallback was written for a customer whose NAME is missing — a walk-in with only a phone number,
 * or a row still loading — where "this customer has no unbilled orders" is exactly right. Reused for
 * a bill with no customer at all it asserts someone who is not there, the same way "Unknown
 * customer" did in the lists.
 *
 * One line covers both reasons a bill can have nobody on it — a counter sale, or a business that
 * does not track customers. Naming the Customers module in the second case would offer a fix to
 * someone who has already decided against it.
 */
export function emptyLine(
  kind: AddItemKind,
  customerName: string,
  hasCustomer: boolean,
): string {
  switch (kind) {
    case 'ORDER':
      if (!hasCustomer) return 'This bill has no customer, so there are no orders to pull in.';
      return `${customerName || 'This customer'} has no unbilled orders.`;
    case 'APPOINTMENT':
      if (!hasCustomer) return 'This bill has no customer, so there are no appointments to pull in.';
      return `${customerName || 'This customer'} has no unbilled appointments.`;
    case 'PRODUCT':
      return 'No products in this catalog yet.';
    default:
      return 'No services in this catalog yet.';
  }
}
