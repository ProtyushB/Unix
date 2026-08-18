import {
  applyPhotoLinks,
  pendingPhotoItems,
  photoWarning,
  readFolderId,
  uploadQuickItemPhotos,
  type QuickPhotoDeps,
} from './quickItemPhotos';

import type { QuickBillItem } from './quickItem';

const PHOTO = { uri: 'file:///mask.jpg', name: 'mask.jpg', type: 'image/jpeg', size: 2048 };

function item(over: Partial<QuickBillItem> = {}): QuickBillItem {
  return {
    lineId: 'q-1',
    name: 'Imported Clay Mask',
    price: 450,
    quantity: 2,
    unit: 'jar',
    discount: 0,
    dmsFolderId: null,
    photos: [],
    photo: null,
    ...over,
  };
}

function deps(over: Partial<QuickPhotoDeps> = {}): QuickPhotoDeps {
  return {
    ensureBillItemFolder: jest.fn().mockResolvedValue({ success: true, data: { folderId: 503 } }),
    uploadFiles: jest
      .fn()
      .mockResolvedValue([
        { id: 91, url: '/x/mask.jpg', fileName: 'mask.jpg', contentType: 'image/jpeg' },
      ]),
    attachQuickItemPhotos: jest.fn().mockResolvedValue({ success: true }),
    ...over,
  };
}

const CONTEXT = { businessId: 3, billId: 52 };

describe('pendingPhotoItems', () => {
  it('is empty when nothing carries a photo', () => {
    expect(pendingPhotoItems([item(), item({ lineId: 'q-2' })])).toEqual([]);
  });

  it('picks only the staged ones', () => {
    const staged = item({ lineId: 'q-2', photo: PHOTO });
    expect(pendingPhotoItems([item(), staged])).toEqual([staged]);
  });

  it('skips an item whose photo already uploaded, so a re-save does not re-upload', () => {
    const done = item({
      photo: PHOTO,
      photos: [{ dmsFileId: 91, url: null, fileName: 'mask.jpg', fileType: null, fileSize: null }],
    });
    expect(pendingPhotoItems([done])).toEqual([]);
  });
});

describe('uploadQuickItemPhotos', () => {
  it('makes NO DMS call at all when no item has a photo', async () => {
    // The whole point of the feature's cheap path: a bill of typed, photoless items must not
    // touch DMS.
    const d = deps();
    const result = await uploadQuickItemPhotos([item(), item({ lineId: 'q-2' })], CONTEXT, d);

    expect(result).toEqual({ links: [], failed: [] });
    expect(d.ensureBillItemFolder).not.toHaveBeenCalled();
    expect(d.uploadFiles).not.toHaveBeenCalled();
    expect(d.attachQuickItemPhotos).not.toHaveBeenCalled();
  });

  it('ensures the folder, uploads, then PATCHes once', async () => {
    const d = deps();
    const result = await uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d);

    expect(d.ensureBillItemFolder).toHaveBeenCalledWith({
      businessId: 3,
      billId: 52,
      lineId: 'q-1',
      itemName: 'Imported Clay Mask',
    });
    expect(d.uploadFiles).toHaveBeenCalledWith([PHOTO], 503);
    expect(d.attachQuickItemPhotos).toHaveBeenCalledTimes(1);
    expect(d.attachQuickItemPhotos).toHaveBeenCalledWith(52, [
      {
        lineId: 'q-1',
        dmsFolderId: 503,
        photos: [
          {
            dmsFileId: 91,
            url: '/x/mask.jpg',
            fileName: 'mask.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
          },
        ],
      },
    ]);
    expect(result.failed).toEqual([]);
  });

  it('omits currentFolderId rather than sending null on a first upload', async () => {
    const d = deps();
    await uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d);
    const params = (d.ensureBillItemFolder as jest.Mock).mock.calls[0][0];
    expect('currentFolderId' in params).toBe(false);
  });

  it('sends currentFolderId when the line already has a folder, so the rename lands', async () => {
    const d = deps();
    await uploadQuickItemPhotos([item({ photo: PHOTO, dmsFolderId: 400 })], CONTEXT, d);
    expect((d.ensureBillItemFolder as jest.Mock).mock.calls[0][0].currentFolderId).toBe(400);
  });

  it('batches several items into ONE PATCH', async () => {
    const d = deps();
    await uploadQuickItemPhotos(
      [item({ photo: PHOTO }), item({ lineId: 'q-2', name: 'Candle', photo: PHOTO })],
      CONTEXT,
      d,
    );
    expect(d.ensureBillItemFolder).toHaveBeenCalledTimes(2);
    expect(d.attachQuickItemPhotos).toHaveBeenCalledTimes(1);
    expect((d.attachQuickItemPhotos as jest.Mock).mock.calls[0][1]).toHaveLength(2);
  });

  it('never re-PUTs the bill', async () => {
    // A full update would mint a second auto-generated order and restock every bare line.
    const d = deps();
    expect(Object.keys(d)).not.toContain('updateBill');
    await uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d);
    expect(d.attachQuickItemPhotos).toHaveBeenCalled();
  });

  it('reports a failed folder by name instead of throwing', async () => {
    const d = deps({
      ensureBillItemFolder: jest.fn().mockResolvedValue({ success: false, error: 'nope' }),
    });
    const result = await uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d);
    expect(result.failed).toEqual(['Imported Clay Mask']);
    expect(d.attachQuickItemPhotos).not.toHaveBeenCalled();
  });

  it('reports a thrown upload instead of failing the save', async () => {
    const d = deps({ uploadFiles: jest.fn().mockRejectedValue(new Error('offline')) });
    await expect(uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d)).resolves.toEqual({
      links: [],
      failed: ['Imported Clay Mask'],
    });
  });

  it('lets the good items through when one fails', async () => {
    const ensure = jest
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: true, data: { folderId: 504 } });
    const d = deps({ ensureBillItemFolder: ensure });

    const result = await uploadQuickItemPhotos(
      [item({ photo: PHOTO }), item({ lineId: 'q-2', name: 'Candle', photo: PHOTO })],
      CONTEXT,
      d,
    );
    expect(result.failed).toEqual(['Imported Clay Mask']);
    expect(result.links.map((l) => l.lineId)).toEqual(['q-2']);
  });

  it('reports every name when the PATCH itself fails — the files are up, the bill is not linked', async () => {
    const d = deps({ attachQuickItemPhotos: jest.fn().mockResolvedValue({ success: false }) });
    const result = await uploadQuickItemPhotos([item({ photo: PHOTO })], CONTEXT, d);
    expect(result.links).toEqual([]);
    expect(result.failed).toEqual(['Imported Clay Mask']);
  });
});

describe('readFolderId', () => {
  it('prefers the folderId key', () => {
    expect(readFolderId({ folderId: 503, other: 9 })).toBe(503);
  });

  it('falls back to the first value when the key is named something else', () => {
    expect(readFolderId({ someOtherKey: 77 })).toBe(77);
  });

  it('is null for an absent or empty map', () => {
    expect(readFolderId(undefined)).toBeNull();
    expect(readFolderId({})).toBeNull();
  });
});

describe('applyPhotoLinks', () => {
  it('writes the folder and photos back, and clears the staged file', () => {
    // Clearing `photo` is what stops the next save re-uploading the same image.
    const items = [item({ photo: PHOTO })];
    const photos = [
      { dmsFileId: 91, url: null, fileName: 'mask.jpg', fileType: 'image/jpeg', fileSize: 2048 },
    ];
    const [updated] = applyPhotoLinks(items, [{ lineId: 'q-1', dmsFolderId: 503, photos }]);

    expect(updated.dmsFolderId).toBe(503);
    expect(updated.photos).toEqual(photos);
    expect(updated.photo).toBeNull();
    expect(pendingPhotoItems([updated])).toEqual([]);
  });

  it('leaves unlinked items alone', () => {
    const items = [item({ photo: PHOTO }), item({ lineId: 'q-2', photo: PHOTO })];
    const result = applyPhotoLinks(items, [{ lineId: 'q-1', dmsFolderId: 503, photos: [] }]);
    expect(result[1]).toBe(items[1]);
  });

  it('returns the same array when there is nothing to apply', () => {
    const items = [item()];
    expect(applyPhotoLinks(items, [])).toBe(items);
  });
});

describe('photoWarning', () => {
  it('is null when everything landed', () => {
    expect(photoWarning([])).toBeNull();
  });

  it('names the items and says the bill itself is fine', () => {
    expect(photoWarning(['Clay Mask', 'Candle'])).toBe(
      "Bill saved — couldn't attach the photo for Clay Mask, Candle. Add it in edit mode.",
    );
  });
});
