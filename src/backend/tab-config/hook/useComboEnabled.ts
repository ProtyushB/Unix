import { useTabConfig } from './useTabConfig';

/**
 * True when combo products are switched on for the current business.
 *
 * Stricter than the web portal's equivalent, on purpose. The flags are normalised with
 * `flag(v) => v !== false` (`tab-config.normalize.ts`), and the fail-closed treatment in
 * `UNRESOLVED_SNAPSHOT` was applied to `tabs` only — every FLAG, `comboEnabled` included, reads
 * `true` before a snapshot lands and `true` forever outside a provider. Gating on the raw flag
 * would therefore show the Normal/Combo toggle on first paint, then blink it away, and show it
 * permanently in the web preview where no provider is mounted.
 *
 * So this waits for `resolved` and for a real business. The cost is that the toggle appears a beat
 * late; the alternative is a control that offers a feature the business may not have.
 *
 * The honest fix is to make `UNRESOLVED_SNAPSHOT` fail closed on flags as well as tabs — but that
 * changes every flag consumer at once, so it is deliberately not bundled into this change.
 */
export function useComboEnabled(): boolean {
  const { comboEnabled, resolved, businessId } = useTabConfig();
  return resolved && businessId != null && comboEnabled === true;
}
