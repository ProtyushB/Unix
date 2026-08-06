import React from 'react';
import { OrderDetailScreen } from './OrderDetailScreen';
import type { DetailMode } from './orderDetail.view';

/** Pharmacy's order detail screen. Identical to parlour's — see `ParlourOrderDetail` for why. */
export function PharmacyOrderDetail(props: {
  route?: { params?: { orderId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <OrderDetailScreen {...props} />;
}

export default PharmacyOrderDetail;
