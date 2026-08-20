/**
 * What a detail screen tells the user once a save, a delete or a per-item action comes back.
 *
 * RN-free so the repo's plain-node jest can cover it, and shared rather than written inline in each
 * screen because they all ask the same question at the end of the same actions — and they all used
 * to answer it the same wrong way: `if (!result.success && result.error) showToast(result.error)`.
 *
 * That guard holds only for as long as something upstream bothers to fill `error` in, and the delete
 * path proves it does not. Deleting a COMPLETED appointment is refused with a sentence worth reading
 * — completed appointments are kept as history, cancel a pending one instead — but that refusal does
 * not always arrive as a rejected request. When it comes back as a 2xx whose body reports the
 * failure, `useModuleService` hands the screen `{ success: false, error: undefined }`: it reads
 * `response.error || response.message` into its own error state and then returns only
 * `response.error`. The guard threw that away, so the confirm dialog closed, the appointment was
 * still sitting in the list, and nothing on screen said why.
 *
 * The promise therefore lives in one function instead of at every call site: an action that did not
 * succeed ALWAYS produces words. A caller may supply better words; it cannot supply none.
 */

/**
 * The part of a module service's result this decision reads.
 *
 * `message` is read alongside `error` because the layers disagree about which field carries the
 * server's sentence, and a screen that looked at only one of them would keep losing the other.
 *
 * `success` is optional so a truncated result — a 204 with an empty body, a service that returned
 * before it filled the field in — still type-checks. It is treated as a failure: not having said the
 * action worked is not the same as it having worked.
 */
export interface ActionOutcome {
  success?: boolean;
  error?: string | null;
  message?: string | null;
}

/**
 * The last thing left to say when the result carries no reason and the caller's fallback is blank
 * too. Vague on purpose — it is the floor under the guarantee, not copy anyone should be seeing.
 */
export const UNEXPLAINED_FAILURE = 'Something went wrong. Please try again.';

/** Words the calling screen holds that no result can carry. */
export interface FailureContext {
  /**
   * Said first, and never displaced by whatever reason the result turns out to have.
   *
   * For a save that needed two calls and got through the first one. The bill screen's payment PATCH
   * commits before its status PATCH runs, so a refused status change leaves the money already
   * recorded on the server — a fact the server's sentence about the status will never mention.
   *
   * That fact used to be passed as `fallback`, which looked like enough and was not: `fallback` is
   * reached only when the result has no reason of its own, and `useModuleService` guarantees one
   * ('Failed to update bill status'). The partial-save sentence became unreachable, and a user
   * whose payment HAD gone through read a toast that said only that the save failed.
   *
   * So the two halves are not rivals for one slot. Only this side knows what already committed;
   * only the server knows why the rest did not. Both get said, in that order.
   */
  prefix?: string;
}

/**
 * The line to show the user, or `null` when there is nothing to complain about.
 *
 * A missing result counts as a failure: an action whose call threw before it could build one has not
 * worked, and staying quiet there would be the same silence wearing a different hat.
 *
 * Blank strings are treated as absent at every step, because the two ways a reason goes missing — a
 * field the server never set, and a field it set to '' — are indistinguishable to the person waiting
 * to be told what happened.
 */
export function failureMessage(
  result: ActionOutcome | null | undefined,
  fallback: string,
  context: FailureContext = {},
): string | null {
  if (result?.success) return null;
  const reason = firstSentence(result?.error, result?.message, fallback);
  const prefix = context.prefix?.trim();
  if (!prefix) return reason ?? UNEXPLAINED_FAILURE;

  // A prefix is words, so the guarantee is already met and `UNEXPLAINED_FAILURE` would only add
  // noise after a sentence that already said something true.
  return reason ? `${prefix} ${reason}` : prefix;
}

function firstSentence(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
