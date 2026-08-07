/**
 * The image stage's rules — a fixed 3:4 portrait box that pages through a product's photos.
 *
 * Specified by the `Product View — 3:4 Image Viewer` frame in
 * `Unix UI Designs/Unix/unix-business-mobile-app.pen` (node `rnxKD`), which draws the stage in
 * context plus four upload cases proving the fit behaviour.
 *
 * ## The fit rule
 *
 * The stage never changes shape. The photo is scaled by `min(stageW / imgW, stageH / imgH)` and
 * centred, so the WHOLE image is always visible and nothing is ever cropped:
 *
 *   - wider than 3:4 (16:9, 1:1) → width binds  → bars top & bottom  (letterbox)
 *   - exactly 3:4                → both bind    → fills edge to edge
 *   - taller than 3:4 (9:16)     → height binds → bars left & right  (pillarbox)
 *
 * That last case is the one the mockup exists to pin down: the rule is `min()` on BOTH axes, not
 * "always fit to width". A 9:16 photo fitted to width would need 569px of height in a 427px stage.
 *
 * There is no arithmetic for this here on purpose — `resizeMode="contain"` IS that formula, exactly,
 * so computing it a second time would only give it a chance to disagree. What lives in this module
 * is the part `contain` does not do: paging.
 *
 * ⚠️ The read view used to be a 160-tall hero with `resizeMode="cover"`, which CROPS. Do not put
 * that back — for a catalog photo, seeing all of a mis-shot product beats seeing the middle of it.
 */

/**
 * Width ÷ height of the stage. React Native's `aspectRatio` takes it in this direction, so 0.75
 * draws a 3-wide by 4-tall box.
 *
 * Expressed as a ratio rather than a fixed height so the stage tracks the screen width. On a 390pt
 * phone with the screen's 16pt gutters that is 358 × 477, which is what the mockup draws.
 */
export const STAGE_ASPECT_RATIO = 3 / 4;

/** Side of a thumbnail in the strip under the stage, and the gap between two of them. */
export const THUMB_SIZE = 60;
export const THUMB_GAP = 8;

/**
 * Whether the pager chrome — counter, dots, thumbnail strip — is worth drawing.
 *
 * One photo has nothing to page between, and "1 / 1" beside a single dot is furniture that says
 * nothing. Zero photos gets the empty stage on its own.
 */
export function showsPager(count: number): boolean {
  return count > 1;
}

/** "1 / 4" — the counter pill, one-based for the reader. */
export function counterLabel(index: number, count: number): string {
  return `${Math.min(index + 1, count)} / ${count}`;
}

/**
 * Keep an index inside a list that may have changed size.
 *
 * Removing the last photo while it is the one on screen would otherwise leave the active index past
 * the end — the counter reads "5 / 4" and no dot is lit. Also the floor for an empty list, so
 * callers get 0 rather than -1.
 */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * Which page a scroll offset has landed on.
 *
 * Rounded, not floored: `pagingEnabled` settles on a whole page, but the offset it reports can be a
 * hair under (`717.9997` for page 2 of a 358-wide stage), and flooring that reads as still being on
 * page 1. Guards `pageWidth` because the first frame measures 0 and dividing by it yields NaN.
 */
export function pageIndexFromOffset(offsetX: number, pageWidth: number, count: number): number {
  if (!(pageWidth > 0)) return 0;
  return clampIndex(Math.round(offsetX / pageWidth), count);
}

/** Where to scroll to put `index` on screen — the inverse of `pageIndexFromOffset`. */
export function offsetForPage(index: number, pageWidth: number): number {
  return Math.max(0, index) * Math.max(0, pageWidth);
}

/**
 * Where to scroll the THUMBNAIL strip so the active thumb is visible.
 *
 * Left-aligns the active thumb rather than centring it: centring hides the thumbs before it, and
 * the strip reads oldest-first, so keeping earlier photos in view is the more useful bias. Never
 * negative — the first thumb sits flush at 0.
 */
export function thumbStripOffset(index: number): number {
  return Math.max(0, index) * (THUMB_SIZE + THUMB_GAP);
}
