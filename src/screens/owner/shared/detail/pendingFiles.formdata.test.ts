/**
 * The last untested link, tested.
 *
 * Everything else about the upload can be exercised from the web preview, but the preview's
 * FormData is the browser's, which rejects a `{uri, name, type}` object outright. The device path
 * runs React Native's own polyfill instead, and that polyfill is what decides whether the multipart
 * part carries a `filename=`. So rather than reason about it, this drives the REAL
 * `react-native/Libraries/Network/FormData` — the exact file that ships in the app — over the exact
 * objects `toPendingFiles` produces, and asserts on the parts it emits.
 *
 * `getParts()` is where the app's data stops and the native layer begins: Android's
 * `NetworkingModule` reads these parts straight through to OkHttp. If the header is right here, it
 * is right on the wire.
 */

// The deep import is the point, not an oversight: `import 'react-native'` would drag the whole
// entry point — native modules, the renderer — into a jest project that is deliberately plain node.
// This file is a leaf with no imports of its own.
// eslint-disable-next-line @react-native/no-deep-imports
import RNFormData, { type FormDataPart } from 'react-native/Libraries/Network/FormData';

import { toPendingFiles } from './pendingFiles';

function partsFor(value: unknown): FormDataPart[] {
  const body = new RNFormData();
  body.append('multipartFiles', value);
  return body.getParts();
}

describe('react-native FormData, over what the picker hands us', () => {
  const asset = { uri: 'file:///storage/emulated/0/DCIM/photo.jpg', fileName: 'photo.jpg' };

  it('emits a filename, which is the whole bug', () => {
    const [part] = partsFor(toPendingFiles([asset])[0]);
    expect(part.headers['content-disposition']).toBe(
      'form-data; name="multipartFiles"; filename="photo.jpg"',
    );
  });

  it('reproduces the failure when the key is spelled fileName', () => {
    // What shipped. RN checks `value.name` and nothing else, so the part goes out anonymous —
    // Spring will not bind a filename-less part to MultipartFile[], and answers 200 with no file.
    const [part] = partsFor({ uri: asset.uri, fileName: 'photo.jpg', type: 'image/jpeg' });
    expect(part.headers['content-disposition']).toBe('form-data; name="multipartFiles"');
    expect(part.headers['content-disposition']).not.toContain('filename');
  });

  it('sends the file as a uri part, not a stringified object', () => {
    // The other half of the same trap: RN only treats a value as a file when it has a `uri`.
    // Anything else becomes `String(value)` — literally "[object Object]" as a text field.
    const [part] = partsFor(toPendingFiles([asset])[0]);
    expect(part.uri).toBe(asset.uri);
    expect(part.string).toBeUndefined();
  });

  it('carries the content type through as the part header', () => {
    const [part] = partsFor(toPendingFiles([{ ...asset, type: 'image/png' }])[0]);
    expect(part.headers['content-type']).toBe('image/png');
  });

  it('still names the part when the picker gave no filename', () => {
    const [part] = partsFor(toPendingFiles([{ uri: asset.uri }])[0]);
    expect(part.headers['content-disposition']).toContain('filename="image-1.jpg"');
  });

  it('percent-encodes a filename with characters the header cannot hold', () => {
    // Not hypothetical: Android providers hand back names with spaces, and iOS with unicode.
    const [part] = partsFor(toPendingFiles([{ ...asset, fileName: 'my photo (1).jpg' }])[0]);
    expect(part.headers['content-disposition']).toContain('filename="my%20photo%20(1).jpg"');
  });

  it('keeps `size` out of the part — RN ignores it, and it must not leak into the headers', () => {
    const [part] = partsFor(toPendingFiles([{ ...asset, fileSize: 2048 }])[0]);
    expect(Object.keys(part.headers)).toEqual(['content-disposition', 'content-type']);
  });
});
