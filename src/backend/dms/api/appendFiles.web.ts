import { NativeFile } from './file.api.interface';

/**
 * Web override of `appendFiles`. Picked up by the preview's bundler through the same
 * platform-extension rule React Native uses (`.web.ts` wins over `.ts`), and invisible to Metro, so
 * no native build ever sees it.
 *
 * The difference is one line, and it is not cosmetic: the browser's `FormData` only accepts a
 * `Blob`/`File`, and stringifies anything else. The picker stub's `uri` is a `blob:` URL from
 * `URL.createObjectURL`, so the bytes are already in the page — reading them back and wrapping them
 * in a real `File` is all that is needed, and the resulting part carries the same three things the
 * native path produces: field name, filename, content type.
 *
 * What this buys is the whole rest of the path: the preview can now add and edit a record with
 * images and hit the real DMS, so the ordering (delete → folder → upload → single write), the file
 * ids coming back, and the metadata landing on the record are all exercisable without a device.
 * What it does NOT prove is the native serialiser itself — that is `pendingFiles.formdata.test.ts`,
 * which drives React Native's own FormData over the same objects.
 */
export async function appendFiles(form: FormData, files: NativeFile[]): Promise<void> {
  for (const file of files) {
    const blob = await (await fetch(file.uri)).blob();
    form.append('multipartFiles', new File([blob], file.name, { type: file.type || blob.type }));
  }
}
