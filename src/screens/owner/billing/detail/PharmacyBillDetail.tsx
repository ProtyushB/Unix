import React from 'react';
import { BillDetailScreen } from './BillDetailScreen';
import type { DetailMode } from './billDetail.view';

/** Pharmacy's bill detail screen. See `ParlourBillDetail` for why the wrapper is this thin. */
export function PharmacyBillDetail(props: {
  route?: { params?: { billId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <BillDetailScreen {...props} />;
}

export default PharmacyBillDetail;
