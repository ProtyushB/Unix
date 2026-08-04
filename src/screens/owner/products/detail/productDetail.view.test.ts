import { toFormState, type ProductFormState } from './productDetail.model';
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
  showsDelete,
  showsEditCta,
  showsInventorySection,
  showsSaleUnitLadder,
  uploadPercent,
  validateProduct,
  validateSaleUnits,
  type DetailViewInput,
} from './productDetail.view';

const v = (over: Partial<DetailViewInput> = {}): DetailViewInput => ({
  mode: 'view',
  loading: false,
  saving: false,
  hasError: false,
  hasItem: true,
  ...over,
});

const form = (over: Partial<ProductFormState> = {}): ProductFormState => ({
  ...toFormState({ name: 'Aloe', price: 349, stockUnit: 'piece' }),
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
    // A fetch that has started but not resolved leaves loading false on the very first render;
    // keying off the item as well is what stops an empty screen flashing.
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

describe('mode → affordances', () => {
  it('only edits in edit and add', () => {
    expect(isEditable('view')).toBe(false);
    expect(isEditable('edit')).toBe(true);
    expect(isEditable('add')).toBe(true);
  });

  it('only deletes something that exists', () => {
    expect(showsDelete('add')).toBe(false);
    expect(showsDelete('view')).toBe(false);
    expect(showsDelete('edit')).toBe(true);
  });

  it('offers the edit jump only from the read-only screen', () => {
    expect(showsEditCta('view')).toBe(true);
    expect(showsEditCta('edit')).toBe(false);
  });

  it('titles the bar per mode', () => {
    expect(appBarTitle('view')).toBe('Product details');
    expect(appBarTitle('edit')).toBe('Edit Product');
    expect(appBarTitle('add')).toBe('New Product');
    expect(saveLabel('add')).toBe('Save Product');
    expect(saveLabel('edit')).toBe('Save');
  });

  it('never says "update this" over a form for a record that does not exist yet', () => {
    expect(detailSubtitle('add', 'parlour product')).toBe('Create a new parlour product');
    expect(detailSubtitle('edit', 'parlour product')).toBe('Update this parlour product');
    // View mode needs none — the product's own name is already the heading.
    expect(detailSubtitle('view', 'parlour product')).toBe('');
  });

  it('hides the ladder for combos, which the server prices differently', () => {
    expect(showsSaleUnitLadder('NORMAL')).toBe(true);
    expect(showsSaleUnitLadder('')).toBe(true);
    expect(showsSaleUnitLadder('COMBO')).toBe(false);
  });

  it('hides the inventory section when the business has the tab off', () => {
    expect(showsInventorySection(true)).toBe(true);
    expect(showsInventorySection(false)).toBe(false);
  });
});

describe('validateProduct', () => {
  it('passes a complete product', () => {
    expect(hasErrors(validateProduct(form()))).toBe(false);
  });

  it('requires a name', () => {
    expect(validateProduct(form({ name: '   ' })).name).toBeTruthy();
  });

  it('requires a price, and distinguishes missing from zero', () => {
    // Free samples are real; an unpriced product is a 400 at the controller.
    expect(validateProduct(form({ price: '' })).price).toBeTruthy();
    expect(validateProduct(form({ price: '0' })).price).toBeUndefined();
  });

  it('rejects negative money and volume', () => {
    expect(validateProduct(form({ price: '-1' })).price).toBeTruthy();
    expect(validateProduct(form({ volume: '-5' })).volume).toBeTruthy();
  });

  it('leaves an empty volume alone', () => {
    expect(validateProduct(form({ volume: '' })).volume).toBeUndefined();
  });
});

describe('validateSaleUnits', () => {
  it('requires a base unit name', () => {
    expect(validateSaleUnits(form({ stockUnit: '' })).stockUnit).toBeTruthy();
  });

  it('requires each pack to be named', () => {
    const errors = validateSaleUnits(form({ packs: [{ unit: '', perStock: '10', price: '45' }] }));
    expect(errors.pack_0).toBeTruthy();
  });

  it('requires a pack to hold at least two base units', () => {
    const errors = validateSaleUnits(
      form({ packs: [{ unit: 'Strip', perStock: '1', price: '5' }] }),
    );
    expect(errors.pack_0).toBeTruthy();
  });

  it('requires the ladder to increase', () => {
    // Mirrors the server's guard. A box that holds fewer units than the strip inside it is not a
    // ladder, and the backend rejects it — better to say so before the round trip.
    const errors = validateSaleUnits(
      form({
        packs: [
          { unit: 'Strip', perStock: '10', price: '45' },
          { unit: 'Box', perStock: '5', price: '200' },
        ],
      }),
    );
    expect(errors.pack_1).toBeTruthy();
  });

  it('accepts a rising ladder', () => {
    const errors = validateSaleUnits(
      form({
        packs: [
          { unit: 'Strip', perStock: '10', price: '45' },
          { unit: 'Box', perStock: '100', price: '400' },
        ],
      }),
    );
    expect(hasErrors(errors)).toBe(false);
  });

  it('exempts combos, as the server does', () => {
    const errors = validateSaleUnits(form({ productType: 'COMBO', stockUnit: '' }));
    expect(hasErrors(errors)).toBe(false);
  });
});

describe('save progress', () => {
  it('starts the bar where the record save left off, never at zero', () => {
    expect(uploadPercent(0, 100)).toBe(UPLOAD_START);
  });

  it('caps below 100 so the server tail still has somewhere to go', () => {
    expect(uploadPercent(100, 100)).toBe(UPLOAD_CEIL);
  });

  it('holds at the start when the total is unknown', () => {
    // Some platforms report no total for a multipart body; a bar that jumps to 100 and waits is
    // worse than one that sits still.
    expect(uploadPercent(50, undefined)).toBe(UPLOAD_START);
    expect(uploadPercent(50, 0)).toBe(UPLOAD_START);
  });

  it('names each phase', () => {
    expect(savePhaseLabel(5)).toBe('Saving…');
    expect(savePhaseLabel(50)).toBe('Uploading images…');
    expect(savePhaseLabel(93)).toBe('Processing on server…');
    expect(savePhaseLabel(96)).toBe('Finalizing…');
    expect(savePhaseLabel(100)).toBe('Done');
  });
});
