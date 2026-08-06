import React from 'react';
import { OrderDetailScreen } from './OrderDetailScreen';
import type { DetailMode } from './orderDetail.view';

/**
 * Parlour's order detail screen.
 *
 * Thinner than its product and service counterparts, and that is the finding rather than an
 * omission: parlour and pharmacy orders are identical. The DTOs are field-for-field the same, both
 * concrete entities add zero columns to the shared `Order` `@MappedSuperclass`, and the two service
 * impls diff to comments. The only visible difference is the module chip in add mode, which
 * `orderDetail.modules.ts` owns and the base screen resolves from the selected module.
 *
 * The wrapper exists anyway, for two reasons: the navigator and the preview registry want a name
 * per module, and the moment the two DIVERGE there is already a file to put the difference in —
 * which is exactly the seam the product screen needed once dispensing arrived.
 */
export function ParlourOrderDetail(props: {
  route?: { params?: { orderId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <OrderDetailScreen {...props} />;
}

export default ParlourOrderDetail;
