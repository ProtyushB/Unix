/**
 * Types for `react-native/Libraries/Network/FormData`, which ships as Flow and so has no `.d.ts`.
 *
 * Declared rather than hand-rolled because `pendingFiles.formdata.test.ts` drives the real module:
 * the point of that test is that it exercises the code the app actually runs, and a stand-in would
 * only re-assert what I already believe. This describes the two members it touches.
 *
 * `getParts()` is the seam where the JS side ends — Android's `NetworkingModule` hands these parts
 * straight to OkHttp, so a `content-disposition` that is right here is right on the wire.
 */
declare module 'react-native/Libraries/Network/FormData' {
  export interface FormDataPart {
    headers: Record<string, string>;
    fieldName: string;
    /** Present on a file part — RN treats any object carrying a `uri` as one. */
    uri?: string;
    /** Present instead of `uri` when the value was not a file and got stringified. */
    string?: string;
    name?: string;
    type?: string;
  }

  export default class FormData {
    append(key: string, value: unknown): void;
    getParts(): FormDataPart[];
  }
}
