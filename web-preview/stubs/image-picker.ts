// Web stub for `react-native-image-picker` — native-only, no browser build.
//
// Rather than no-op, this opens a real <input type="file"> so the picker's whole downstream path
// (pending files, the strip's Add tile, remove, the save-then-upload ordering) can be exercised in
// the preview. The object it hands back matches the fields the app reads off an Asset: `uri`,
// `fileName`, `type`, `fileSize`.
//
// Uploading used to be impossible from here, and it is worth recording why, because a vaguer
// version of this comment once claimed the opposite. The browser File picked here never reaches
// the request: the app maps the asset to `{uri, name, type}`, React Native's convention for a file
// part. The browser's FormData has no such convention — it is not a Blob, so `append` falls back
// to `String(value)` and the part goes out as the literal text "[object Object]".
//
// `appendFiles.web.ts` closes that gap by reading the blob: uri back into a real File, so the whole
// path — pick, upload, link, the metadata landing on the record — is now exercisable in the
// preview against live DMS. What remains device-only is React Native's own serialiser, which
// `pendingFiles.formdata.test.ts` drives directly.

export interface Asset {
  uri?: string;
  fileName?: string;
  type?: string;
  fileSize?: number;
}

export interface ImagePickerResponse {
  didCancel?: boolean;
  errorCode?: string;
  errorMessage?: string;
  assets?: Asset[];
}

interface Options {
  selectionLimit?: number;
  mediaType?: string;
}

export function launchImageLibrary(options: Options = {}): Promise<ImagePickerResponse> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if ((options.selectionLimit ?? 0) !== 1) input.multiple = true;

    // A cancelled file dialog fires no event at all in most browsers, so the promise would hang
    // forever. Resolving on window focus is the standard escape hatch.
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files || input.files.length === 0) resolve({ didCancel: true });
        window.removeEventListener('focus', onFocus);
      }, 400);
    };
    window.addEventListener('focus', onFocus);

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      window.removeEventListener('focus', onFocus);
      if (!files.length) return resolve({ didCancel: true });
      resolve({
        assets: files.map((file) => ({
          uri: URL.createObjectURL(file),
          fileName: file.name,
          type: file.type,
          fileSize: file.size,
        })),
      });
    };

    input.click();
  });
}

export function launchCamera(): Promise<ImagePickerResponse> {
  // No camera in the preview; the app only offers the library path anyway.
  return Promise.resolve({ didCancel: true });
}
