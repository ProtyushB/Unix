import { NativeFile } from './file.api.interface';

/**
 * Put picked files onto a multipart body — the one step of the upload that is genuinely
 * platform-specific.
 *
 * React Native's `FormData` treats any object carrying a `uri` as a file part, reading `name` for
 * the `filename=` and `type` for the part's content type; the native layer then streams the bytes
 * off that uri. Nothing needs to be read into JS, which is the whole point on a device.
 *
 * The DOM's `FormData` has no such convention. Handed the same object it falls back to
 * `String(value)` and appends the literal text "[object Object]" — a silent no-op with a 200 on it,
 * the same failure mode as the missing `filename=`. That is why the web override next door exists:
 * without it the preview cannot upload at all, so nothing about this path could be exercised
 * without a device.
 */
export async function appendFiles(form: FormData, files: NativeFile[]): Promise<void> {
  for (const file of files) {
    // The cast is unavoidable and safe: the signature is the DOM's, which knows nothing about RN's
    // uri convention. What matters is that `file` is a real `NativeFile` — the compiler checks that
    // at every call site, which is precisely the guard that was missing when `name` was spelled
    // `fileName` and every device upload silently shipped an unnamed part.
    form.append('multipartFiles', file as unknown as Blob);
  }
}
