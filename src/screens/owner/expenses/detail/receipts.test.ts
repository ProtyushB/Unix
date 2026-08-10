import {
  fileKindLabel,
  formatFileSize,
  isImageType,
  receiptMeta,
  removeReceiptAt,
  toReceiptRows,
} from './receipts';

describe('formatFileSize', () => {
  it('scales through B, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(245_760)).toBe('240 KB');
    expect(formatFileSize(1_468_006)).toBe('1.4 MB');
  });

  it('drops the decimal above 10 MB, where it is noise', () => {
    expect(formatFileSize(14 * 1024 * 1024)).toBe('14 MB');
  });

  it('answers empty for unknown or nonsense sizes rather than "0 B"', () => {
    // "0 B" would be a claim about the file; empty lets the caller collapse the separator.
    expect(formatFileSize(null)).toBe('');
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(-5)).toBe('');
    expect(formatFileSize(NaN)).toBe('');
  });
});

describe('isImageType', () => {
  it('treats anything not obviously an image as a document', () => {
    // Guessing "image" gives a broken <Image> with no explanation; guessing "document" gives a
    // file glyph beside a correct filename, which still reads.
    expect(isImageType('image/jpeg')).toBe(true);
    expect(isImageType('IMAGE/PNG')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
    expect(isImageType('application/octet-stream')).toBe(false);
    expect(isImageType(null)).toBe(false);
    expect(isImageType('')).toBe(false);
  });
});

describe('fileKindLabel', () => {
  it('prefers the filename extension — that is what the user sees elsewhere', () => {
    expect(fileKindLabel('cctv-invoice.jpg', 'image/jpeg')).toBe('JPG');
    expect(fileKindLabel('electricity-bill.pdf', 'application/pdf')).toBe('PDF');
  });

  it('falls back to the MIME subtype when the name has no extension', () => {
    // DMS has been observed to omit the content type, and some pickers omit the name — neither
    // alone should produce a blank label.
    expect(fileKindLabel('receipt', 'application/pdf')).toBe('PDF');
    expect(fileKindLabel(null, 'image/png')).toBe('PNG');
  });

  it('says FILE rather than nothing when neither is known', () => {
    expect(fileKindLabel(null, null)).toBe('FILE');
    expect(fileKindLabel('', '')).toBe('FILE');
  });

  it('ignores a long trailing segment that is not really an extension', () => {
    // "invoice.september" is a name with a dot, not a file kind.
    expect(fileKindLabel('invoice.september', 'application/pdf')).toBe('PDF');
  });
});

describe('receiptMeta', () => {
  it('joins kind and size, and collapses the separator when the size is unknown', () => {
    expect(receiptMeta('a.pdf', 'application/pdf', 245_760)).toBe('PDF · 240 KB');
    expect(receiptMeta('a.pdf', 'application/pdf', null)).toBe('PDF');
  });
});

describe('toReceiptRows', () => {
  const saved = [
    { dmsFileId: 9, fileName: 'cctv-invoice.jpg', fileType: 'image/jpeg', fileSize: 524_288, url: 'https://dms/9' },
  ];
  const pending = [
    { uri: 'file:///r.pdf', name: 'receipt.pdf', type: 'application/pdf', size: 245_760 },
  ];

  it('puts SAVED rows first, so a pending row does not jump position once it uploads', () => {
    const rows = toReceiptRows(saved, pending);
    expect(rows.map((r) => r.name)).toEqual(['cctv-invoice.jpg', 'receipt.pdf']);
    expect(rows.map((r) => r.pending)).toEqual([false, true]);
  });

  it('describes each row', () => {
    const [savedRow, pendingRow] = toReceiptRows(saved, pending);
    expect(savedRow.meta).toBe('JPG · 512 KB');
    expect(savedRow.isDocument).toBe(false);
    expect(savedRow.url).toBe('https://dms/9');

    expect(pendingRow.meta).toBe('PDF · 240 KB');
    expect(pendingRow.isDocument).toBe(true);
    // No server URL yet — nothing can open it until it has been uploaded.
    expect(pendingRow.url).toBeNull();
  });

  it('keys rows by ORIGIN, so a saved and a pending row at the same index cannot collide', () => {
    // Sharing a key would make React reuse one row's state for the other.
    const rows = toReceiptRows(saved, pending);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(rows[0].key.startsWith('saved-')).toBe(true);
    expect(rows[1].key.startsWith('pending-')).toBe(true);
  });

  it('never renders a nameless row', () => {
    const rows = toReceiptRows([{ dmsFileId: 1 }], [{ uri: 'u', name: '', type: '' }]);
    expect(rows[0].name).toBe('Receipt 1');
    expect(rows[1].name).toBe('Receipt 2');
  });

  it('handles both lists being empty', () => {
    expect(toReceiptRows([], [])).toEqual([]);
  });
});

describe('removeReceiptAt', () => {
  const saved = [
    { dmsFileId: 1, fileName: 'a.jpg' },
    { dmsFileId: 2, fileName: 'b.jpg' },
  ];
  const pending = [
    { uri: 'u1', name: 'c.pdf', type: 'application/pdf' },
    { uri: 'u2', name: 'd.pdf', type: 'application/pdf' },
  ];

  it('removes from SAVED when the index falls in the first block', () => {
    const out = removeReceiptAt(saved, pending, 0);
    expect(out.saved.map((f) => f.dmsFileId)).toEqual([2]);
    expect(out.pending).toBe(pending);
  });

  it('removes from PENDING when the index falls past the saved rows', () => {
    // The strip renders one list and reports one index; the split is the whole job here.
    const out = removeReceiptAt(saved, pending, 2);
    expect(out.saved).toBe(saved);
    expect(out.pending.map((f) => f.name)).toEqual(['d.pdf']);
  });

  it('removes the LAST pending row correctly', () => {
    expect(removeReceiptAt(saved, pending, 3).pending.map((f) => f.name)).toEqual(['c.pdf']);
  });

  it('leaves both lists alone for an out-of-range index, BY REFERENCE', () => {
    // Reference, not just deep equality: both arrays feed setState, and a filtered copy that
    // removed nothing is still a new identity — a re-render, and a `files` array that "changed"
    // without changing.
    const high = removeReceiptAt(saved, pending, 9);
    expect(high.saved).toBe(saved);
    expect(high.pending).toBe(pending);

    const low = removeReceiptAt(saved, pending, -1);
    expect(low.saved).toBe(saved);
    expect(low.pending).toBe(pending);
  });
});
