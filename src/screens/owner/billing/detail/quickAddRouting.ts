/**
 * Where a quick-added catalog row lands when the bill is saved.
 *
 * Quick-adding a product from the bill's picker does NOT always make a bare line. Some products
 * cannot be billed bare at all — the server spawns an ORDER for them, deducts their stock through
 * the order funnel and attaches that order to the bill. Which of the two happens is not a user
 * choice and is not a setting on the bill: it is `is_order_required` on the catalog row
 * (`is_appointment_required` for services), both `NOT NULL DEFAULT true` since ModuleX V111.
 *
 * These predicates MIRROR the server's decision (`ParlourBillServiceImpl#requiresOrder` and the
 * `isAppointmentRequired` branch of `createAppointmentFromCustomServices`). The server is the
 * authority — it re-reads the flag off the catalog row on every save, so a client that guessed
 * differently would simply be wrong about what it just told the user. This exists so the picker can
 * SAY which of the two is about to happen, as the mockup's "added as a bare line, or via a new
 * order" caption promises.
 *
 * ⚠️ Both default to "needs a record" when the flag is absent, and the direction matters: bare is
 * the behaviour change, so an older backend or a stale cached row must never read as bare.
 */

/** The fields these predicates read. Anything else on the row is ignored. */
export interface RoutableProduct {
  productType?: unknown;
  isOrderRequired?: unknown;
}

export interface RoutableService {
  isAppointmentRequired?: unknown;
}

/**
 * True when quick-adding this product will auto-generate an order.
 *
 * A COMBO always rides an order whatever its flag says: a combo's inventory deduction expands to
 * its sub-products inside the order funnel, machinery a flat bare line has no way to reproduce. The
 * backend enforces the same rail, so the picker must not promise otherwise.
 */
export function productNeedsOrder(product: RoutableProduct | null | undefined): boolean {
  return product?.productType === 'COMBO' || product?.isOrderRequired !== false;
}

/** True when quick-adding this service will auto-generate an appointment. */
export function serviceNeedsAppointment(service: RoutableService | null | undefined): boolean {
  return service?.isAppointmentRequired !== false;
}

/** Split quick-added products into the two destinations. */
export function partitionProductsByDestination<T extends RoutableProduct>(
  products: T[] | null | undefined,
): { orderBound: T[]; bare: T[] } {
  const list = Array.isArray(products) ? products : [];
  return {
    orderBound: list.filter((p) => productNeedsOrder(p)),
    bare: list.filter((p) => !productNeedsOrder(p)),
  };
}

/** Split quick-added services into the two destinations. */
export function partitionServicesByDestination<T extends RoutableService>(
  services: T[] | null | undefined,
): { appointmentBound: T[]; bare: T[] } {
  const list = Array.isArray(services) ? services : [];
  return {
    appointmentBound: list.filter((s) => serviceNeedsAppointment(s)),
    bare: list.filter((s) => !serviceNeedsAppointment(s)),
  };
}

/**
 * The caption under a picked row, saying what saving will actually do with it.
 *
 * Worth the words. "Adds a new order" is a surprising outcome for someone who thinks they ticked a
 * product, and it is visible afterwards: the bill grows an ORDER line they did not attach, which
 * then behaves like any other attached order.
 */
export function destinationNote(needsRecord: boolean, kind: 'PRODUCT' | 'SERVICE'): string {
  if (!needsRecord) return 'Billed directly';
  return kind === 'PRODUCT' ? 'Will create an order' : 'Will create an appointment';
}
