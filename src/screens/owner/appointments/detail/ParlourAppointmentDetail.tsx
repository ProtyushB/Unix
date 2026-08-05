import React from 'react';
import { AppointmentDetailScreen } from './AppointmentDetailScreen';
import type { DetailMode } from './appointmentDetail.view';

/**
 * Parlour's appointment detail screen.
 *
 * Thin, and deliberately so: parlour and pharmacy appointments are identical bar the service
 * catalog, which comes from whichever module hook is active rather than from any config. The
 * wrapper exists because the navigator and the preview registry want a name per module, and
 * because the moment the two diverge there is already a file to put the difference in.
 */
export function ParlourAppointmentDetail(props: {
  route?: { params?: { appointmentId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}) {
  return <AppointmentDetailScreen {...props} />;
}

export default ParlourAppointmentDetail;
