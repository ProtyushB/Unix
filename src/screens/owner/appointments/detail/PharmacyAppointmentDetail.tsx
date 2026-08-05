import React from 'react';
import { AppointmentDetailScreen } from './AppointmentDetailScreen';
import type { DetailMode } from './appointmentDetail.view';

/** Pharmacy's appointment detail screen. Identical to parlour's — see `ParlourAppointmentDetail`. */
export function PharmacyAppointmentDetail(props: {
  route?: { params?: { appointmentId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <AppointmentDetailScreen {...props} />;
}

export default PharmacyAppointmentDetail;
