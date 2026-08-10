import { toDmsFiles, toPendingDocuments, toPendingFiles } from './pendingFiles';

describe('toPendingFiles', () => {
  it('names the key `name`, because FormData reads value.name for the filename', () => {
    // The regression this file exists for. Spelled `fileName`, the multipart part ships with no
    // filename, Spring binds nothing, the request still returns 200 and the upload silently does
    // nothing — on every real device, while the web preview passes.
    const [file] = toPendingFiles([
      { uri: 'file:///a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
    ]);
    expect(file.name).toBe('a.jpg');
    expect(Object.keys(file)).toContain('name');
    expect(Object.keys(file)).not.toContain('fileName');
  });

  it('carries the byte size through, for DMS_File.fileSize', () => {
    expect(toPendingFiles([{ uri: 'file:///a.jpg', fileSize: 2048 }])[0].size).toBe(2048);
  });

  it('keeps the device file:// uri untouched', () => {
    const [file] = toPendingFiles([{ uri: 'file:///storage/emulated/0/DCIM/x.jpg' }]);
    expect(file.uri).toBe('file:///storage/emulated/0/DCIM/x.jpg');
  });

  it('invents a filename when the picker gives none', () => {
    // Android providers routinely omit fileName; the server still needs one.
    const [file] = toPendingFiles([{ uri: 'file:///a.jpg' }]);
    expect(file.name).toBe('image-1.jpg');
  });

  it('continues numbering from what is already pending, so a second pick cannot collide', () => {
    const files = toPendingFiles([{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }], 2);
    expect(files.map((f) => f.name)).toEqual(['image-3.jpg', 'image-4.jpg']);
  });

  it('defaults the mime type rather than sending undefined', () => {
    expect(toPendingFiles([{ uri: 'file:///a.jpg' }])[0].type).toBe('image/jpeg');
  });

  it('drops assets the picker returned with no uri', () => {
    expect(toPendingFiles([{ fileName: 'ghost.jpg' }, { uri: 'file:///a.jpg' }])).toHaveLength(1);
  });

  it('handles a cancelled pick', () => {
    expect(toPendingFiles(undefined)).toEqual([]);
    expect(toPendingFiles([])).toEqual([]);
  });
});

describe('toDmsFiles', () => {
  const pending = [{ uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', size: 2048 }];

  it('stores all five DMS_File fields, not just the id', () => {
    // A mobile-saved row used to carry only dmsFileId, so the same table held two shapes depending
    // on whether the phone or the web portal wrote it.
    const [f] = toDmsFiles(
      [{ id: 7, url: 'https://dms/x.jpg', fileName: 'a.jpg', contentType: 'image/jpeg' }],
      pending,
    );
    expect(f).toEqual({
      dmsFileId: 7,
      url: 'https://dms/x.jpg',
      fileName: 'a.jpg',
      fileType: 'image/jpeg',
      fileSize: 2048,
    });
  });

  it('falls back to the picked asset when the response omits a content type', () => {
    const [f] = toDmsFiles([{ id: 7, url: 'u', fileName: 'a.jpg' }], pending);
    expect(f.fileType).toBe('image/jpeg');
  });

  it('pairs results with pending files positionally', () => {
    const two = [
      { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', size: 1 },
      { uri: 'file:///b.png', name: 'b.png', type: 'image/png', size: 2 },
    ];
    const got = toDmsFiles([{ id: 1 }, { id: 2 }], two);
    expect(got.map((f) => f.fileSize)).toEqual([1, 2]);
    expect(got.map((f) => f.fileType)).toEqual(['image/jpeg', 'image/png']);
  });

  it('nulls the extras rather than inventing them when nothing is known', () => {
    expect(toDmsFiles([{ id: 9 }])).toEqual([
      { dmsFileId: 9, url: null, fileName: null, fileType: null, fileSize: null },
    ]);
  });
});

describe('toPendingDocuments', () => {
  it('normalises the document picker’s DIFFERENT key names', () => {
    // expo-document-picker returns name/size/mimeType where the image picker returns
    // fileName/fileSize/type. Reading the wrong one produces a filename-less part that Spring
    // declines to bind — and the request still answers 200, which is what makes it invisible.
    const [f] = toPendingDocuments([
      { uri: 'file:///r.pdf', name: 'receipt.pdf', size: 240_000, mimeType: 'application/pdf' },
    ]);
    expect(f).toEqual({
      uri: 'file:///r.pdf',
      name: 'receipt.pdf',
      type: 'application/pdf',
      size: 240_000,
    });
  });

  it('does NOT guess a PDF when the picker omits the MIME type', () => {
    // A picker that told us nothing has told us nothing; "application/pdf" would be a claim.
    const [f] = toPendingDocuments([{ uri: 'file:///x', name: 'x' }]);
    expect(f.type).toBe('application/octet-stream');
  });

  it('numbers unnamed documents from startIndex, so successive picks do not collide', () => {
    const got = toPendingDocuments([{ uri: 'a' }, { uri: 'b' }], 2);
    expect(got.map((f) => f.name)).toEqual(['document-3', 'document-4']);
  });

  it('drops entries the picker returned without a uri', () => {
    expect(toPendingDocuments([{ name: 'no uri' }, { uri: 'a', name: 'ok' }])).toHaveLength(1);
    expect(toPendingDocuments(undefined)).toEqual([]);
    expect(toPendingDocuments([])).toEqual([]);
  });
});

describe('toPendingFiles fallbacks', () => {
  it('still defaults to an IMAGE, so the product and service forms are unchanged', () => {
    const [f] = toPendingFiles([{ uri: 'file:///a' }]);
    expect(f.name).toBe('image-1.jpg');
    expect(f.type).toBe('image/jpeg');
  });

  it('accepts a different fallback, so a receipt is not named image-1.jpg', () => {
    // Naming a PDF image-1.jpg and declaring it image/jpeg uploads a document every reader then
    // tries to decode as a photo.
    const [f] = toPendingFiles([{ uri: 'file:///a' }], 0, {
      namePrefix: 'receipt',
      extension: 'pdf',
      type: 'application/pdf',
    });
    expect(f.name).toBe('receipt-1.pdf');
    expect(f.type).toBe('application/pdf');
  });

  it('prefers what the picker actually reported over any fallback', () => {
    const [f] = toPendingFiles([{ uri: 'u', fileName: 'real.png', type: 'image/png' }], 0, {
      namePrefix: 'receipt',
      extension: 'pdf',
      type: 'application/pdf',
    });
    expect(f.name).toBe('real.png');
    expect(f.type).toBe('image/png');
  });
});
