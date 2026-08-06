import React from 'react';
import { BillDetailScreen } from './BillDetailScreen';
import type { DetailMode } from './billDetail.view';

/**
 * Parlour's bill detail screen.
 *
 * Thin, and deliberately so: `ParlourBillServiceImpl` and `PharmacyBillServiceImpl` are line-for-
 * line siblings, and the only thing that differs on screen is which catalog the Quick Add tab
 * lists — which comes from whichever module hook is active, not from any config. The wrapper exists
 * because the navigator and the preview registry want a name per module, and because the moment the
 * two diverge there is already a file to put the difference in.
 */
export function ParlourBillDetail(props: {
  route?: { params?: { billId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <BillDetailScreen {...props} />;
}

export default ParlourBillDetail;
