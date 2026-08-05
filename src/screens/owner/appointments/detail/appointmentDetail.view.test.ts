import { toFormState, type AppointmentFormState } from './appointmentDetail.model';
import { newServiceLine } from './appointmentLines';
import {
  configFor,
  PARLOUR_APPOINTMENT_CONFIG,
  PHARMACY_APPOINTMENT_CONFIG,
} from './appointmentDetail.modules';
import {
  appBarSubtitle,
  appBarTitle,
  canEdit,
  deriveDetailView,
  errorSummary,
  hasErrors,
  isEditable,
  lockedReason,
  saveLabel,
  showsDelete,
  showsEditCta,
  validateAppointment,
} from './appointmentDetail.view';

const READY = {
  mode: 'view' as const,
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
};

describe('deriveDetailView', () => {
  it('matches the order and product screens exactly', () => {
    expect(deriveDetailView({ ...READY, saving: true, hasError: true, hasItem: false })).toBe(
      'SAVING',
    );
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: false })).toBe('ERROR');
    expect(deriveDetailView({ ...READY, hasError: true, hasItem: true })).toBe('READY');
    expect(deriveDetailView({ ...READY, mode: 'add', loading: true, hasItem: false })).toBe(
      'READY',
    );
    expect(deriveDetailView({ ...READY, loading: true })).toBe('LOADING');
  });
});

describe('mode gates and copy', () => {
  it('gates by mode', () => {
    expect(isEditable('view')).toBe(false);
    expect(showsDelete('edit')).toBe(true);
    expect(showsDelete('add')).toBe(false);
    expect(showsEditCta('view')).toBe(true);
  });

  it('titles and subtitles each mode as drawn', () => {
    expect(appBarTitle('add', '')).toBe('Create Appointment');
    expect(appBarTitle('view', 'APT-05082026-001')).toBe('APT-05082026-001');
    expect(appBarTitle('view', '')).toBe('Appointment details');
    expect(appBarSubtitle('add')).toBe('Schedule a new appointment');
  });

  it('uses the shorter Save label the mockup draws for create', () => {
    expect(saveLabel('add')).toBe('Save');
    expect(saveLabel('edit')).toBe('Save Changes');
  });

  it('locks a billed appointment', () => {
    expect(canEdit(true)).toBe(false);
    expect(lockedReason('BILL-1')).toContain('BILL-1');
    expect(lockedReason(null)).toContain('on a bill');
  });
});

describe('validateAppointment', () => {
  const form = (over: Partial<AppointmentFormState> = {}): AppointmentFormState => ({
    ...toFormState(null),
    customerId: 7,
    date: '2026-08-05',
    time: '10:00',
    lines: [newServiceLine(21, 2500, null)],
    ...over,
  });

  it('passes a complete appointment', () => {
    expect(hasErrors(validateAppointment(form()))).toBe(false);
  });

  it('requires a customer rather than defaulting to person 1 like the web portal does', () => {
    expect(validateAppointment(form({ customerId: null })).customer).toBeTruthy();
  });

  it('requires a date and a time, because a null datetime is a 500 not a 400', () => {
    expect(validateAppointment(form({ date: '' })).date).toBeTruthy();
    expect(validateAppointment(form({ time: '' })).time).toBeTruthy();
  });

  it('requires at least one service', () => {
    expect(validateAppointment(form({ lines: [] })).services).toBeTruthy();
  });

  it('rejects a zero-quantity line', () => {
    const line = { ...newServiceLine(21, 2500, null), quantity: 0 };
    expect(validateAppointment(form({ lines: [line] }))['line.0.quantity']).toBeTruthy();
  });

  it('summarises to the most useful message', () => {
    expect(errorSummary(validateAppointment(form({ customerId: null })))).toContain('customer');
    expect(errorSummary(validateAppointment(form({ date: '' })))).toContain('date');
    expect(errorSummary(validateAppointment(form({ lines: [] })))).toContain('service');
  });
});

describe('module config', () => {
  it('differs only in the label — the catalog difference needs no config', () => {
    expect(PARLOUR_APPOINTMENT_CONFIG.moduleLabel).toBe('Parlour');
    expect(PHARMACY_APPOINTMENT_CONFIG.moduleLabel).toBe('Pharmacy');
    expect(configFor('PHARMACY')).toBe(PHARMACY_APPOINTMENT_CONFIG);
    expect(configFor('PARLOUR')).toBe(PARLOUR_APPOINTMENT_CONFIG);
  });
});
