import { toFormState, type ServiceFormState } from './serviceDetail.model';
import {
  UPLOAD_CEIL,
  UPLOAD_START,
  appBarTitle,
  deriveDetailView,
  detailSubtitle,
  hasErrors,
  isEditable,
  saveLabel,
  savePhaseLabel,
  shouldLoadProductOptions,
  showsAvailabilitySegment,
  showsDelete,
  showsEditCta,
  uploadPercent,
  validateService,
  type DetailViewInput,
} from './serviceDetail.view';

const v = (over: Partial<DetailViewInput> = {}): DetailViewInput => ({
  mode: 'view',
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
  ...over,
});

const form = (over: Partial<ServiceFormState> = {}): ServiceFormState => ({
  ...toFormState({ name: 'Bridal Makeup', price: 15000, duration: 180 }),
  ...over,
});

describe('deriveDetailView', () => {
  it('shows the record once it has loaded', () => {
    expect(deriveDetailView(v())).toBe('READY');
  });

  it('waits while the record is in flight', () => {
    expect(deriveDetailView(v({ loading: true }))).toBe('LOADING');
  });

  it('waits when there is no record yet even if loading already flipped false', () => {
    expect(deriveDetailView(v({ hasItem: false }))).toBe('LOADING');
  });

  it('never loads in add mode — there is nothing to fetch', () => {
    expect(deriveDetailView(v({ mode: 'add', hasItem: false }))).toBe('READY');
  });

  it('puts saving above everything, because the overlay blocks the screen', () => {
    expect(deriveDetailView(v({ saving: true, hasError: true, loading: true }))).toBe('SAVING');
  });

  it('puts an error above the wait', () => {
    expect(deriveDetailView(v({ hasError: true, loading: true }))).toBe('ERROR');
  });
});

describe('mode mapping', () => {
  it('is editable in edit and add only', () => {
    expect(isEditable('view')).toBe(false);
    expect(isEditable('edit')).toBe(true);
    expect(isEditable('add')).toBe(true);
  });

  it('only deletes something that exists', () => {
    expect(showsDelete('add')).toBe(false);
    expect(showsDelete('view')).toBe(true);
    expect(showsDelete('edit')).toBe(true);
  });

  it('offers the edit jump only from the read-only screen', () => {
    expect(showsEditCta('view')).toBe(true);
    expect(showsEditCta('edit')).toBe(false);
  });

  it('shows the availability segment only in a form', () => {
    expect(showsAvailabilitySegment('view')).toBe(false);
    expect(showsAvailabilitySegment('edit')).toBe(true);
    expect(showsAvailabilitySegment('add')).toBe(true);
  });

  it('titles each mode', () => {
    expect(appBarTitle('add')).toBe('New Service');
    expect(appBarTitle('edit')).toBe('Edit Service');
    expect(appBarTitle('view')).toBe('Service details');
  });

  it('says "Save Service" in BOTH form modes, unlike the product screen', () => {
    // Products shortens to "Save" when editing. The service mockups draw the same wide button with
    // a check glyph on create and edit alike.
    expect(saveLabel('add')).toBe('Save Service');
    expect(saveLabel('edit')).toBe('Save Service');
  });

  it('subtitles add from the mockup and edit from the entity label', () => {
    expect(detailSubtitle('add', 'parlour service')).toBe('Add a new service to your offerings');
    expect(detailSubtitle('edit', 'pharmacy service')).toBe('Update this pharmacy service');
    expect(detailSubtitle('view', 'parlour service')).toBe('');
  });
});

describe('shouldLoadProductOptions', () => {
  it('always loads in a form, where anything can be picked', () => {
    expect(shouldLoadProductOptions('add', 0)).toBe(true);
    expect(shouldLoadProductOptions('edit', 0)).toBe(true);
  });

  it('loads in read mode only when there are ids to name', () => {
    expect(shouldLoadProductOptions('view', 0)).toBe(false);
    expect(shouldLoadProductOptions('view', 2)).toBe(true);
  });
});

describe('validateService', () => {
  it('accepts a filled form', () => {
    expect(validateService(form())).toEqual({});
  });

  it('requires a name', () => {
    expect(validateService(form({ name: '   ' })).name).toBeTruthy();
  });

  it('requires a price and rejects a negative one', () => {
    expect(validateService(form({ price: '' })).price).toBeTruthy();
    expect(validateService(form({ price: '-1' })).price).toBeTruthy();
    expect(validateService(form({ price: '0' })).price).toBeUndefined();
  });

  it('leaves duration blank-valid, because blank means nobody said', () => {
    expect(validateService(form({ duration: '' })).duration).toBeUndefined();
  });

  it('rejects a zero or negative duration, which the server would accept', () => {
    expect(validateService(form({ duration: '0' })).duration).toBeTruthy();
    expect(validateService(form({ duration: '-5' })).duration).toBeTruthy();
  });

  it('enforces the server @Size(max = 1000) on description', () => {
    expect(validateService(form({ description: 'x'.repeat(1000) })).description).toBeUndefined();
    expect(validateService(form({ description: 'x'.repeat(1001) })).description).toBeTruthy();
  });

  it('reports whether anything failed', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: 'nope' })).toBe(true);
  });
});

describe('save progress', () => {
  it('starts the bar at the upload floor when the size is unknown', () => {
    expect(uploadPercent(0, undefined)).toBe(UPLOAD_START);
    expect(uploadPercent(10, 0)).toBe(UPLOAD_START);
  });

  it('never exceeds the upload ceiling — the tail is the server thinking', () => {
    expect(uploadPercent(100, 100)).toBe(UPLOAD_CEIL);
    expect(uploadPercent(999, 100)).toBe(UPLOAD_CEIL);
  });

  it('labels each phase', () => {
    expect(savePhaseLabel(0)).toBe('Saving…');
    expect(savePhaseLabel(50)).toBe('Uploading images…');
    expect(savePhaseLabel(93)).toBe('Processing on server…');
    expect(savePhaseLabel(96)).toBe('Finalizing…');
    expect(savePhaseLabel(100)).toBe('Done');
  });
});
