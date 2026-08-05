/**
 * Per-module configuration for the Appointment Detail screen.
 *
 * As thin as the order screen's, and for the same reason. The Pencil set's subtitle says "Parlour &
 * pharmacy appointments are identical (only the service catalog differs)", and the backend agrees:
 * both concrete entities add exactly one field to the shared `Appointment` `@MappedSuperclass`
 * (`employmentId`, and both add the same one), and the two DTOs match field for field.
 *
 * "Only the catalog differs" needs no config at all — the catalog comes from whichever module hook
 * is active, which the screen already resolves.
 */

export type AppointmentModuleKey = 'PARLOUR' | 'PHARMACY';

export interface AppointmentModuleConfig {
  moduleKey: AppointmentModuleKey;
  /** The chip beside "Create Appointment" in add mode. The only visible difference. */
  moduleLabel: string;
  /** Sub-line on the services picker: "New appointment · Parlour". */
  pickerSubtitle: string;
}

export const PARLOUR_APPOINTMENT_CONFIG: AppointmentModuleConfig = {
  moduleKey: 'PARLOUR',
  moduleLabel: 'Parlour',
  pickerSubtitle: 'New appointment · Parlour',
};

export const PHARMACY_APPOINTMENT_CONFIG: AppointmentModuleConfig = {
  moduleKey: 'PHARMACY',
  moduleLabel: 'Pharmacy',
  pickerSubtitle: 'New appointment · Pharmacy',
};

export function configFor(key: AppointmentModuleKey): AppointmentModuleConfig {
  return key === 'PHARMACY' ? PHARMACY_APPOINTMENT_CONFIG : PARLOUR_APPOINTMENT_CONFIG;
}
