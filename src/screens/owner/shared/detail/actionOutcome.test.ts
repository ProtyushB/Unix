import { failureMessage, UNEXPLAINED_FAILURE } from './actionOutcome';

describe('failureMessage', () => {
  it('says nothing when the action worked', () => {
    expect(failureMessage({ success: true }, 'Could not delete this appointment.')).toBeNull();
    expect(failureMessage({ success: true, error: null }, 'Could not save.')).toBeNull();
  });

  it("shows the server's reason when there is one", () => {
    const refusal =
      'Cannot delete a COMPLETED appointment (id=42); completed appointments are retained as ' +
      'history. Cancel a pending appointment instead.';
    expect(
      failureMessage({ success: false, error: refusal }, 'Could not delete this appointment.'),
    ).toBe(refusal);
  });

  it('still speaks when the reason is undefined', () => {
    // The bug. Deleting a COMPLETED appointment is refused with that reason, but when the refusal
    // arrives as a 2xx whose body reports the failure, `useModuleService` returns only
    // `response.error` — undefined — and the screen's `if (!result.success && result.error)` guard
    // dropped it. The dialog closed, the appointment stayed, and nothing was said.
    expect(failureMessage({ success: false }, 'Could not delete this appointment.')).toBe(
      'Could not delete this appointment.',
    );
    expect(
      failureMessage({ success: false, error: null }, 'Could not save this appointment.'),
    ).toBe('Could not save this appointment.');
  });

  it('still speaks when the reason is an empty string', () => {
    // `result.error ?? fallback` looks like a fix and is not: '' is not nullish, so it passes the
    // guard and shows an empty toast, which is silence with extra steps.
    expect(
      failureMessage({ success: false, error: '' }, 'Could not delete this appointment.'),
    ).toBe('Could not delete this appointment.');
    expect(
      failureMessage({ success: false, error: '   ' }, 'Could not delete this appointment.'),
    ).toBe('Could not delete this appointment.');
  });

  it('reads `message` when the reason came back under that field instead', () => {
    // Which field carries the sentence depends on the shape of the response, not on the code, so
    // reading only `error` loses the reason on exactly the responses that have one.
    expect(
      failureMessage(
        { success: false, message: 'This appointment is on bill INV-9.' },
        'Could not delete.',
      ),
    ).toBe('This appointment is on bill INV-9.');
    expect(
      failureMessage(
        { success: false, error: 'Refused.', message: 'ignored' },
        'Could not delete.',
      ),
    ).toBe('Refused.');
  });

  it('treats a missing result as a failure', () => {
    // An optional service method that is not implemented, or a call that threw before it could build
    // a result. Returning null here would reopen the hole from the other side.
    expect(failureMessage(undefined, 'Could not delete this appointment.')).toBe(
      'Could not delete this appointment.',
    );
    expect(failureMessage(null, 'Could not delete this appointment.')).toBe(
      'Could not delete this appointment.',
    );
  });

  it('never returns an empty string, whatever it is handed', () => {
    // The guarantee itself: a caller that forgot its own fallback still gets words.
    expect(failureMessage({ success: false, error: '' }, '')).toBe(UNEXPLAINED_FAILURE);
    expect(failureMessage({}, '   ')).toBe(UNEXPLAINED_FAILURE);
    expect(failureMessage(undefined, '')).toBe(UNEXPLAINED_FAILURE);
  });

  it('trims the reason it shows', () => {
    expect(failureMessage({ success: false, error: '  Refused.\n' }, 'Could not delete.')).toBe(
      'Refused.',
    );
  });
});

describe('failureMessage — a prefix the caller already knows to be true', () => {
  const PARTIAL = 'The payment was saved, but the status was not.';

  it('keeps the prefix in front of the reason instead of losing to it', () => {
    // The bug this option exists for. The bill screen's payment PATCH commits, its status PATCH is
    // refused, and the refusal always arrives with words in `error` — so as a `fallback` the
    // partial-save sentence could never be reached, and the toast read as a total failure over a
    // payment the server had already taken.
    expect(
      failureMessage(
        { success: false, error: 'Bill CANCELLED cannot return to DRAFT.' },
        'The server did not say why.',
        { prefix: PARTIAL },
      ),
    ).toBe(`${PARTIAL} Bill CANCELLED cannot return to DRAFT.`);
  });

  it('keeps the prefix in front of a synthesized reason too', () => {
    // `useModuleService.updateBillStatus` fills `error` with this whenever the server left it
    // empty. It is generic, but it still must not be what displaces the specific half.
    expect(
      failureMessage({ success: false, error: 'Failed to update bill status' }, '', {
        prefix: PARTIAL,
      }),
    ).toBe(`${PARTIAL} Failed to update bill status`);
  });

  it('reads `message` after the prefix, same as it does without one', () => {
    expect(
      failureMessage({ success: false, message: 'This bill is locked.' }, 'Unused.', {
        prefix: PARTIAL,
      }),
    ).toBe(`${PARTIAL} This bill is locked.`);
  });

  it('falls back after the prefix when the result carries no reason', () => {
    // The sibling branch: the module never wired `updateBillStatus`, so there is no result at all
    // and the only reason available is the caller's. It goes where a server sentence would.
    expect(
      failureMessage(undefined, 'This module cannot change a bill status.', { prefix: PARTIAL }),
    ).toBe(`${PARTIAL} This module cannot change a bill status.`);
  });

  it('lets the prefix stand alone rather than padding it', () => {
    // With nothing to append, the prefix is already a whole sentence. Adding UNEXPLAINED_FAILURE
    // after it would tell a user whose payment went through to "try again", which is the one thing
    // they must not do.
    expect(failureMessage({ success: false, error: '' }, '', { prefix: PARTIAL })).toBe(PARTIAL);
    expect(failureMessage(undefined, '   ', { prefix: PARTIAL })).toBe(PARTIAL);
    expect(failureMessage({}, '', { prefix: `  ${PARTIAL}  ` })).toBe(PARTIAL);
  });

  it('ignores a blank prefix instead of gluing a space onto the reason', () => {
    expect(failureMessage({ success: false, error: 'Refused.' }, 'Unused.', { prefix: '' })).toBe(
      'Refused.',
    );
    expect(failureMessage({ success: false }, '', { prefix: '   ' })).toBe(UNEXPLAINED_FAILURE);
  });

  it('still says nothing when the action worked', () => {
    // A prefix describes a half-finished save. There is no such thing on a save that finished.
    expect(failureMessage({ success: true }, 'Unused.', { prefix: PARTIAL })).toBeNull();
  });
});
