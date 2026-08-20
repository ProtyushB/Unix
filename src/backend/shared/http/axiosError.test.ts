import { extractErrorInfo, extractErrorMessage } from './axiosError';

/**
 * A rejected axios error, cut down to the properties this module actually reads.
 *
 * `status` is carried only so a fixture can state which HTTP failure it is modelling; nothing in the
 * module reads it. It is a parameter because the shapes that matter most here — a bodyless proxy
 * 502, a hand-built 502 from the DMS controller — are not 400s, and a fixture that says 400 while
 * its message says 502 documents a response that never existed.
 */
function rejected(data: unknown, message = 'Request failed with status code 400', status = 400) {
  return { response: { status, data }, message, isAxiosError: true };
}

/** The ModuleX wrapper as it arrives on a handled failure. */
function wrapper(over: Record<string, unknown> = {}) {
  return {
    success: false,
    code: 'INVALID_ARGUMENT',
    message: 'Invalid request data',
    data: null,
    error: 'Batch already consumed',
    ...over,
  };
}

/**
 * The raw PostgreSQL text ModuleX drops into `error` on a foreign-key violation, copied from what
 * `ex.getMostSpecificCause().getMessage()` actually produces. Every fragment of it is something the
 * user must never see: internal table names, a constraint name, and a live primary key.
 */
const RAW_POSTGRES =
  'ERROR: update or delete on table "parlour_order" violates foreign key constraint ' +
  '"fk_bill_order_id" on table "parlour_bill"  Detail: Key (id)=(42) is still referenced from ' +
  'table "parlour_bill".';

/**
 * What Spring 6.2 hands the catch-all when a query names a column the schema does not have. Copied
 * from the `InvalidDataAccessResourceUsageException` shape Boot 3.4 / Hibernate 6.6 produce: the
 * statement, the driver's own `ERROR:` line, and the position, all in one string.
 */
const BAD_SQL_GRAMMAR =
  'JDBC exception executing SQL [select b1_0.id,b1_0.discount_pct from parlour_bill b1_0 ' +
  'where b1_0.business_id=?] [ERROR: column b1_0.discount_pct does not exist\n  Position: 15] [n/a]';

/** The JDK 21 helpful-NPE text, which names the entity class, the getter and the local. */
const HELPFUL_NPE =
  'Cannot invoke "com.modulex.parlour.entity.Bill.getCustomer()" because "bill" is null';

/** The nginx body a 502 mid-deploy returns, verbatim in shape. */
const NGINX_502 =
  '<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n' +
  '<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx/1.24.0</center>\r\n' +
  '</body>\r\n</html>\r\n';

/**
 * A unique-constraint dump. It reaches the client whenever the violation is raised somewhere that
 * `DataIntegrityViolationException` is not what surfaces — a DMS insert, or a ModuleX save whose
 * cause chain was flattened to a bare message — so the code that would have routed it to
 * `integrityBody` is absent and the raw driver text travels as-is.
 */
const CONSTRAINT_DUMP = 'ERROR: duplicate key value violates unique constraint "uk_folder_name"';

/**
 * `ResourceAccessException`'s template, re-emitted by `DmsEntityFolderController`. The single most
 * sensitive fragment this module handles: an internal hostname and the port it listens on.
 */
const CONNECTION_REFUSED =
  'DMS folder creation failed: I/O error on POST request for ' +
  '"http://10.0.0.7:8081/api/folders": Connection refused';

/**
 * A response that was cut off mid-write, so axios could not parse it and handed the body over as a
 * string. It carries no marker any other rule looks for — the quoted `"INTERNAL_ERROR"` has no
 * colon after it, there is no bracketed statement, no qualified name and no newline — and it fits
 * inside the length bound. Only its opening brace gives it away.
 */
const TRUNCATED_JSON =
  '{"success":false,"code":"INTERNAL_ERROR","message":"An error occurred","error":"could not prepa';

/**
 * `LocalStorageService`'s two rename failures, which interpolate an absolute path with no
 * conditional and no redaction. POSIX is what the server actually runs; the Windows spelling is
 * what the same service produces on a developer's machine pointed at a real client.
 */
const POSIX_PATH_REASON = 'Source folder does not exist: /var/dms/storage/folders/12';
const WINDOWS_PATH_REASON = 'Target folder already exists: C:\\dms\\storage\\folders\\12';

/**
 * What `AppointmentMapper` produces for an unknown status. Both `toEntity` and `toShallowEntity`
 * call `AppointmentStatus.valueOf` with no try/catch, reached inline from the appointment POST and
 * PUT controllers, so the JDK's message is stamped INVALID_ARGUMENT — a code that used to be
 * ungated, which put the enum's package and class straight into a toast.
 */
const ENUM_MESSAGE = 'No enum constant com.modulex.common.enums.AppointmentStatus.X';

describe('precedence', () => {
  // The wrapper's `message` is a fixed label stamped on every handled failure, so preferring it
  // would replace "Batch already consumed" with "Invalid request data" on every error the backend
  // rejects — the user is told something went wrong but never what.
  it('prefers the body error over the body message', () => {
    expect(extractErrorMessage(rejected(wrapper()), 'fallback')).toBe('Batch already consumed');
  });

  it('falls back to the body message when the body has no error', () => {
    expect(extractErrorMessage(rejected(wrapper({ error: undefined })), 'fallback')).toBe(
      'Invalid request data',
    );
  });

  // A real HTTP error response that carried no readable body: an empty 502 from the proxy, a
  // bodyless 401. axios still attaches `response`, so `data` is present-but-undefined and every
  // field read below it misses. Not a transport failure — a reset connection, a DNS miss or an
  // aborted timeout leaves axios with NO `response` property at all, and that case is
  // 'reads a network error that never got a response' in the non-axios-throws block. Not the
  // unhandled-500 case either: that one DOES carry a wrapper, because ModuleX's catch-all builds
  // one for every exception that reaches it (see the INTERNAL_ERROR block below).
  it('falls back to the thrown error message when the response carried no body', () => {
    const err = rejected(undefined, 'Request failed with status code 502', 502);
    expect(extractErrorMessage(err, 'fb')).toBe('Request failed with status code 502');
  });

  it('falls back to the caller fallback when there is nothing else', () => {
    const err = { response: { data: {} }, message: '' };
    expect(extractErrorMessage(err, 'Failed to delete product')).toBe('Failed to delete product');
  });
});

// ModuleX's GlobalExceptionHandler stamps a label into `message` and the real sentence into `error`
// for 21 of its 23 code/message pairings. These are the two that do the opposite, and the layout of
// each was copied from the Java rather than guessed.
describe('codes whose message and error are inverted', () => {
  // `error` here is whatever PostgreSQL said. Preferring it printed a foreign-key constraint, two
  // table names and the row's primary key into a toast on the user's phone.
  it('prefers the curated message on a foreign-key CONSTRAINT_VIOLATION', () => {
    const err = rejected(
      wrapper({
        code: 'CONSTRAINT_VIOLATION',
        message: 'Related record missing or in use',
        error: RAW_POSTGRES,
      }),
      'Request failed with status code 409',
    );
    expect(extractErrorMessage(err, 'Failed to delete order')).toBe(
      'Related record missing or in use',
    );
  });

  it('leaks no fragment of the raw postgres text', () => {
    const err = rejected(
      wrapper({
        code: 'CONSTRAINT_VIOLATION',
        message: 'Related record missing or in use',
        error: RAW_POSTGRES,
      }),
      'Request failed with status code 409',
    );
    const shown = extractErrorMessage(err, 'Failed to delete order');
    for (const secret of [
      'ERROR:',
      'parlour_order',
      'parlour_bill',
      'fk_bill_order_id',
      'Key (id)=(42)',
      'constraint',
    ]) {
      expect(shown).not.toContain(secret);
    }
  });

  // The same code is also used for the non-FK integrity failures, which answer 500 with the generic
  // curated line. `error` is still raw cause text there, so the branch has to cover both.
  it('prefers the curated message on a non-foreign-key CONSTRAINT_VIOLATION', () => {
    const err = rejected(
      wrapper({
        code: 'CONSTRAINT_VIOLATION',
        message: 'Data integrity violation',
        error: 'ERROR: null value in column "business_id" violates not-null constraint',
      }),
      'Request failed with status code 500',
    );
    expect(extractErrorMessage(err, 'fb')).toBe('Data integrity violation');
  });

  // Error-first showed "Concurrent modification detected" — true, and useless. The half worth
  // reading is the one that names the way out.
  it('prefers the actionable message on OPTIMISTIC_LOCK', () => {
    const err = rejected(
      wrapper({
        code: 'OPTIMISTIC_LOCK',
        message: 'The record was modified by another user. Please refresh and try again.',
        error: 'Concurrent modification detected',
      }),
      'Request failed with status code 409',
    );
    expect(extractErrorMessage(err, 'Failed to update appointment')).toBe(
      'The record was modified by another user. Please refresh and try again.',
    );
  });

  // DUPLICATE_ENTRY is built by the SAME integrityBody() helper as CONSTRAINT_VIOLATION but laid
  // out the usual way. A blanket flip would answer every duplicate with the words "Duplicate entry"
  // and throw away the field that names which value collided.
  it('still prefers error on DUPLICATE_ENTRY, which comes off the same helper', () => {
    const err = rejected(
      wrapper({
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate entry',
        error: "A record with name 'Gold Facial' already exists",
      }),
      'Request failed with status code 409',
    );
    expect(extractErrorMessage(err, 'fb')).toBe("A record with name 'Gold Facial' already exists");
  });

  it('still prefers error on an ordinary INVALID_ARGUMENT', () => {
    expect(extractErrorMessage(rejected(wrapper()), 'fb')).toBe('Batch already consumed');
  });

  it('still prefers error on the other labelled codes', () => {
    const cases = [
      [{ code: 'VALIDATION', message: 'Validation failed', error: 'quantity: must be positive' }],
      [{ code: 'NOT_FOUND', message: 'Not found', error: 'Order not found with id: 42' }],
      [
        {
          code: 'ORDER_LOCKED',
          message: 'Order locked by a finalized bill',
          error: 'Order 42 is billed on bill 7',
        },
      ],
    ] as const;
    for (const [over] of cases) {
      expect(extractErrorMessage(rejected(wrapper(over)), 'fb')).toBe(over.error);
    }
  });

  // The inversion changes which field is asked first, nothing else. Dropping out of the wrapper
  // entirely on a blank `message` would answer a real conflict with axios's status line.
  it('falls back to error when an inverted code left message blank', () => {
    const err = rejected(
      wrapper({
        code: 'OPTIMISTIC_LOCK',
        message: '   ',
        error: 'Concurrent modification detected',
      }),
      'Request failed with status code 409',
    );
    expect(extractErrorMessage(err, 'fb')).toBe('Concurrent modification detected');
  });

  it('falls back to error when an inverted code omitted message entirely', () => {
    const err = rejected(
      wrapper({ code: 'CONSTRAINT_VIOLATION', message: undefined, error: 'Related record in use' }),
      'Request failed with status code 409',
    );
    expect(extractErrorMessage(err, 'fb')).toBe('Related record in use');
  });

  it('still reports the code alongside the inverted message', () => {
    const err = rejected(
      wrapper({
        code: 'OPTIMISTIC_LOCK',
        message: 'The record was modified by another user. Please refresh and try again.',
        error: 'Concurrent modification detected',
      }),
    );
    expect(extractErrorInfo(err, 'fb')).toEqual({
      code: 'OPTIMISTIC_LOCK',
      message: 'The record was modified by another user. Please refresh and try again.',
    });
  });
});

// INTERNAL_ERROR is the catch-all: `@ExceptionHandler(Exception.class)` stamps "An error occurred"
// into `message` and a bare `ex.getMessage()` into `error`. Both halves are unusable some of the
// time, so this code is neither error-first nor message-first — `error` wins only while it still
// reads like a sentence someone wrote.
describe('the catch-all code, whose error field is gated on shape', () => {
  /** The catch-all wrapper, whose `message` is a constant and whose `error` is the variable. */
  function catchAll(error: unknown) {
    return rejected(
      wrapper({ code: 'INTERNAL_ERROR', message: 'An error occurred', error }),
      'Request failed with status code 500',
    );
  }

  // The regression this block exists for. The ~51 call sites this module replaced read
  // `(err as Error).message` — axios's status line, which never opens the body — so a broken query
  // used to surface as "Request failed with status code 500". Error-first put the SELECT list, the
  // driver's ERROR: line and the missing column into a toast on the user's phone instead.
  it('leaks no fragment of a bad-SQL-grammar body', () => {
    const shown = extractErrorMessage(catchAll(BAD_SQL_GRAMMAR), 'Failed to load bills');
    for (const secret of [
      'ERROR:',
      'SQL [',
      'discount_pct',
      'parlour_bill',
      'select',
      'Position:',
    ]) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Failed to load bills');
  });

  // Java 21 turns every NPE into a sentence that names the class, its package and the accessor.
  // That is a map of the domain model, handed to whoever is holding the phone.
  it('leaks no fragment of a helpful-NPE body', () => {
    const shown = extractErrorMessage(catchAll(HELPFUL_NPE), 'Failed to open bill');
    for (const secret of ['com.modulex', 'getCustomer', 'Cannot invoke', 'is null']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Failed to open bill');
  });

  // Only DataIntegrityViolationException has its own data-access handler. Every other
  // DataAccessException subtype lands here, and Spring and Hibernate build all of their messages
  // by embedding the nested PSQLException text and the statement.
  it('refuses the other machine shapes that reach the same handler', () => {
    const dumps = [
      'could not prepare statement [ERROR: relation "parlour_bill" does not exist] ' +
        '[select b1_0.id from parlour_bill b1_0]',
      'StatementCallback; bad SQL grammar [select * from parlour_order where id = ?]',
      'could not execute statement [ERROR: deadlock detected\n  Detail: Process 4211 waits for ' +
        'ShareLock on transaction 90210] [update parlour_bill set version=? where id=?]',
      'could not initialize proxy [com.modulex.parlour.entity.Order#42] - no Session',
      'JSON parse error: Cannot deserialize value of type `java.time.LocalDate` from String ' +
        '"2026-13-01"',
      'Cannot read field "quantity" because "line" is null',
      `org.hibernate.exception.SQLGrammarException: ${'x'.repeat(400)}`,
    ];
    for (const dump of dumps) {
      expect(extractErrorMessage(catchAll(dump), 'Failed to save order')).toBe(
        'Failed to save order',
      );
    }
  });

  // The other half of the trade. ModuleX throws 63 bare RuntimeExceptions whose text is curated,
  // and all 63 come out of this same handler. A blanket flip to message-first would answer every
  // one of them with "An error occurred", which names neither the operation nor the cause.
  it('still shows a curated throw that reads like a sentence', () => {
    expect(extractErrorMessage(catchAll('No Appointments Found'), 'fb')).toBe(
      'No Appointments Found',
    );
  });

  it('still shows the other curated throws, interpolated ids and all', () => {
    const curated = [
      'One or more categories not found',
      'Invalid business type: PHARMACY',
      'No Orders Found for Business ID: 7',
      'Inventory batch does not belong to this business',
      "No Persons Were Found with ID's: [3, 7]",
      'Error mapping DTO to Entity',
    ];
    for (const reason of curated) {
      expect(extractErrorMessage(catchAll(reason), 'Failed to load orders')).toBe(reason);
    }
  });

  // When the gate refuses, the two strings still on offer are worse than the caller's. The label is
  // a constant, and the status line is implied by the code itself — neither says what broke.
  it('prefers the caller fallback to the label and to the axios status line', () => {
    const shown = extractErrorMessage(catchAll(BAD_SQL_GRAMMAR), 'Failed to delete order');
    expect(shown).toBe('Failed to delete order');
    expect(shown).not.toBe('An error occurred');
    expect(shown).not.toBe('Request failed with status code 500');
  });

  // A `new RuntimeException()` with no text, or an NPE the JVM could not describe, leaves `error`
  // null. Same outcome as a refused one: name the operation rather than the constant.
  it('uses the caller fallback when the catch-all carried no error text', () => {
    for (const empty of [undefined, null, '', '   ', 500]) {
      expect(extractErrorMessage(catchAll(empty), 'Failed to update bill')).toBe(
        'Failed to update bill',
      );
    }
  });

  it('takes a curated reason at the length bound and refuses the one past it', () => {
    const at = `No Orders Found for Business ID: ${'7'.repeat(167)}`;
    const over = `${at}7`;
    expect(at).toHaveLength(200);
    expect(extractErrorMessage(catchAll(at), 'Failed to load orders')).toBe(at);
    expect(extractErrorMessage(catchAll(over), 'Failed to load orders')).toBe(
      'Failed to load orders',
    );
  });

  // The catch-all is no longer the only gated code — every code is — so what this asserts now is
  // that widening the gate did not cost the other codes their curated sentences.
  it('leaves the other codes their curated sentences', () => {
    expect(
      extractErrorMessage(
        rejected(wrapper({ code: 'NOT_FOUND', error: 'Order not found with id: 42' })),
        'fb',
      ),
    ).toBe('Order not found with id: 42');
    expect(
      extractErrorMessage(
        rejected(
          wrapper({ code: 'INSUFFICIENT_STOCK', error: 'Only 3 units of Gold Facial left' }),
        ),
        'fb',
      ),
    ).toBe('Only 3 units of Gold Facial left');
  });

  it('still reports the code alongside a gated message', () => {
    expect(extractErrorInfo(catchAll(BAD_SQL_GRAMMAR), 'Failed to load bills')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Failed to load bills',
    });
  });

  // Refusing the text must never refuse the guarantee. A caller that passed a blank fallback still
  // gets a toast with words in it rather than an empty one the user reads as success.
  it('is never empty, whatever the catch-all carried', () => {
    for (const error of [BAD_SQL_GRAMMAR, HELPFUL_NPE, '', null, 'No Appointments Found']) {
      for (const fb of ['Failed to delete', '', '   ']) {
        const shown = extractErrorMessage(catchAll(error), fb);
        expect(shown.trim().length).toBeGreaterThan(0);
        expect(shown).not.toContain('com.modulex');
        expect(shown).not.toContain('ERROR:');
      }
    }
  });
});

/**
 * Every opener JEP-358 can produce, each with a plain identifier as the null receiver.
 *
 * Only the first carries a fully-qualified name, because the JVM prints the declaring class of the
 * method it could not call; the other seven name nothing but a local, a parameter or a field. That
 * is the whole point of the list — the earlier gate matched `Cannot invoke "` and
 * `Cannot read field "` literally, and its fully-qualified-name rule was the only thing standing
 * behind them, so six of these eight reached a toast intact.
 */
const NPE_FORMS = [
  'Cannot invoke "com.modulex.parlour.entity.Bill.getCustomer()" because "bill" is null',
  'Cannot read field "quantity" because "line" is null',
  'Cannot assign field "quantity" because "line" is null',
  'Cannot read the array length because "orderIds" is null',
  'Cannot store to object array because "rows" is null',
  'Cannot load from int array because "rows" is null',
  'Cannot enter synchronized block because "lock" is null',
  'Cannot throw exception because "ex" is null',
];

/**
 * JDK-formatted exception text with no marker of any kind in it.
 *
 * None of these has a handler in `GlobalExceptionHandler`, so `NoSuchElementException`,
 * `IndexOutOfBoundsException`, `ArithmeticException`, `DateTimeParseException` and the
 * `Collectors.toMap` `IllegalStateException` all reach `@ExceptionHandler(Exception.class)` and
 * their raw text becomes the toast. "No value present" is the worst of them: it names nothing, and
 * it reads enough like an answer that the user stops looking for one.
 */
const JDK_CANNED = [
  'No value present',
  'Index 0 out of bounds for length 0',
  'Index -1 out of bounds for length 12',
  'Index: 5, Size: 3',
  'Range [0, 4) out of bounds for length 3',
  'Range [2, 2 + 5) out of bounds for length 4',
  'Array index out of range: -1',
  'String index out of range: 12',
  'begin 0, end 10, length 5',
  '/ by zero',
  'Division by zero',
  'Division undefined',
  'BigInteger divide by zero',
  'Rounding necessary',
  'Non-terminating decimal expansion; no exact representable decimal result.',
  'integer overflow',
  'long overflow',
  "Text '2026-13-01' could not be parsed at index 5",
  "Text '2026-13-01' could not be parsed: Invalid value for MonthOfYear (valid values 1 - 12): 13",
  "Text '2026-01-01T10:00' could not be parsed, unparsed text found at index 10",
  'Duplicate key 42 (attempted merging values ParlourOrderDto@1a2b3c and ParlourOrderDto@4d5e6f)',
];

describe('the JDK 21 helpful-NPE shape, in all eight of its spellings', () => {
  function catchAll(error: unknown) {
    return rejected(
      wrapper({ code: 'INTERNAL_ERROR', message: 'An error occurred', error }),
      'Request failed with status code 500',
      500,
    );
  }

  it('refuses every opener and leaks neither the receiver nor the member', () => {
    for (const form of NPE_FORMS) {
      const shown = extractErrorMessage(catchAll(form), 'Failed to save order');
      expect(shown).toBe('Failed to save order');
      // Quoted, because the receiver names are the leak and several of them are also ordinary
      // English words that a legitimate fallback may contain.
      const secrets = ['because', 'is null', '"bill"', '"line"', '"rows"', '"orderIds"', '"lock"'];
      for (const secret of secrets) {
        expect(shown).not.toContain(secret);
      }
    }
  });

  // The six that used to walk straight through. The assertion on the fixture is the load-bearing
  // half: it pins that no qualified name appears in them, so the fully-qualified-name marker cannot
  // be what refuses them and the new shape rules have to be doing the work.
  it('refuses the six openers that carry no qualified name at all', () => {
    const unqualified = NPE_FORMS.slice(2);
    expect(unqualified).toHaveLength(6);
    for (const form of unqualified) {
      expect(form).not.toMatch(/\b(?:com|org|net|io|java|javax|jakarta)\.[a-z0-9_]+\./);
      expect(extractErrorMessage(catchAll(form), 'Failed to save order')).toBe(
        'Failed to save order',
      );
    }
  });

  // `DmsEntityFolderController` re-emits whatever its `catch (RuntimeException e)` caught as
  // `"DMS folder creation failed: " + e.getMessage()`, so the JVM's sentence arrives buried in the
  // middle of someone else's. The opener rule is anchored and cannot see it; the tail rule can.
  it('refuses an opener that arrives nested inside another message', () => {
    const nested = 'DMS folder creation failed: Cannot read field "folderId" because "row" is null';
    expect(extractErrorMessage(catchAll(nested), 'Failed to attach photo')).toBe(
      'Failed to attach photo',
    );
  });

  // The curated sentences that come closest to the two new rules, taken from ModuleX rather than
  // imagined: seven real `Cannot …` throws whose second word is not a bytecode verb, and the only
  // two curated strings in the backend that contain the word `because`. Both of those end on a full
  // stop, which is why the tail rule is anchored on `is null` instead of just looking for `because`.
  it('still shows the curated sentences that start Cannot or contain because', () => {
    const curated = [
      'Cannot remove a CONFIRMED product line.',
      'Cannot remove the last item from an order — cancel the order instead.',
      'Cannot instantiate abstract Bill directly',
      'Cannot record payment on plan with status: CANCELLED',
      'Cannot transition to ACTIVE: batch has no remaining quantity',
      'Cannot delete a COMPLETED order (id=42)',
      'Cannot activate employment that has not been accepted. Employee must accept the ' +
        'employment invitation first.',
      'Order 42 is locked because it is on a PAID bill. Cancel the bill before changing the order.',
      'Batch 7 cannot be deleted because it has been used or is system-generated. Record a ' +
        'wastage/transfer or change its status instead.',
    ];
    for (const reason of curated) {
      expect(extractErrorMessage(catchAll(reason), 'Failed to save order')).toBe(reason);
    }
  });
});

describe("the JDK's canned runtime text, which carries no marker to catch", () => {
  function catchAll(error: unknown) {
    return rejected(
      wrapper({ code: 'INTERNAL_ERROR', message: 'An error occurred', error }),
      'Request failed with status code 500',
      500,
    );
  }

  it('refuses every canned template in favour of the caller fallback', () => {
    for (const canned of JDK_CANNED) {
      expect(extractErrorMessage(catchAll(canned), 'Failed to load orders')).toBe(
        'Failed to load orders',
      );
    }
  });

  // The one worth naming on its own. It is short, it is grammatical, and it answers "why did my
  // orders not load" with nothing at all, so the user reads it as a real result and stops.
  it("refuses Optional's No value present, which sounds like an answer and is not", () => {
    const shown = extractErrorMessage(catchAll('No value present'), 'Failed to load orders');
    expect(shown).toBe('Failed to load orders');
    expect(shown).not.toContain('No value present');
  });

  // The templates are anchored whole because the JDK formats them from a constant, so a sentence
  // that merely opens or closes the same way is untouched. None of these is a ModuleX throw — they
  // exist to show the anchors are what make the rule narrow enough to be safe.
  it('leaves a sentence that only resembles a canned template alone', () => {
    const nearMisses = [
      'No value present for the selected slot, pick another time',
      'Index 0 out of bounds for length 0 rows in the imported sheet',
      'Rounding necessary before the bill can be settled',
      'Discount / by zero is not a valid rule',
    ];
    for (const reason of nearMisses) {
      expect(extractErrorMessage(catchAll(reason), 'Failed to load orders')).toBe(reason);
    }
  });

  // The bound the whole gate is built to protect: the 63 curated throws still come through.
  it('still shows the curated throws unchanged', () => {
    const curated = [
      'No Appointments Found',
      'No Orders Found for Business ID: 7',
      'One or more categories not found',
      'Invalid business type: PHARMACY',
      "No Persons Were Found with ID's: [3, 7]",
      'Inventory batch does not belong to this business',
    ];
    for (const reason of curated) {
      expect(extractErrorMessage(catchAll(reason), 'Failed to load orders')).toBe(reason);
    }
  });
});

/**
 * A failure body assembled by a controller rather than by `GlobalExceptionHandler`.
 *
 * `ApiResponseWrapper.code` is `@JsonInclude(NON_NULL)` and only the exception handler ever sets it,
 * so these bodies reach the client with no `code` field at all — which is exactly what makes them
 * dangerous: with no code, neither the inverted branch nor the catch-all branch fires, and `error`
 * used to be taken raw with no gate of any kind in front of it.
 */
function codeless(error: unknown, message = 'Entity folder request failed') {
  return { success: false, message, data: null, error };
}

describe('a body with no code, which no gate used to cover', () => {
  // `DmsClient` calls `restTemplate.exchange` with no try/catch, so a DMS failure behind nginx comes
  // back as a `HttpServerErrorException` whose message quotes a preview of the gateway's own page.
  // `DmsEntityFolderController`'s `catch (RuntimeException e)` copies that straight into `error`.
  // This is the leak the bare-string `'<'` test was written for, arriving on a JSON body it cannot
  // see — so the markup check had to move into the field gate as well.
  it('refuses an nginx page quoted into the error field', () => {
    const err = rejected(
      codeless(`DMS folder creation failed: 502 Bad Gateway: "${NGINX_502}"`),
      'Request failed with status code 502',
      502,
    );
    const shown = extractErrorMessage(err, 'Failed to attach photo');
    for (const secret of ['<', 'nginx', 'html', 'Bad Gateway']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Entity folder request failed');
  });

  // The other half of the same route: DMS answered nothing at all. Spring's `ResourceAccessException`
  // template names the host and port it could not reach, which is infrastructure the user's phone
  // has no business being told about.
  it('refuses a refused-connection message naming an internal host and port', () => {
    const err = rejected(
      codeless(
        'DMS folder creation failed: I/O error on POST request for ' +
          '"http://10.20.0.14:8081/api/folders": Connection refused',
      ),
      'Request failed with status code 502',
      502,
    );
    const shown = extractErrorMessage(err, 'Failed to attach photo');
    for (const secret of ['10.20.0.14', '8081', 'I/O error', 'http://']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Entity folder request failed');
  });

  // A `DataAccessException` raised while the folder id is persisted is a `RuntimeException` too, so
  // it takes the same branch and the statement travels out on a codeless body.
  it('refuses a raw SQL error on a codeless body', () => {
    const err = rejected(
      codeless(`DMS folder creation failed: ${BAD_SQL_GRAMMAR}`),
      'Request failed with status code 502',
      502,
    );
    const shown = extractErrorMessage(err, 'Failed to attach photo');
    for (const secret of ['ERROR:', 'SQL [', 'discount_pct', 'parlour_bill', 'select']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Entity folder request failed');
  });

  it('refuses a helpful NPE on a codeless body', () => {
    const err = rejected(codeless(`DMS folder creation failed: ${HELPFUL_NPE}`), 'axios', 502);
    const shown = extractErrorMessage(err, 'Failed to attach photo');
    for (const secret of ['com.modulex', 'getCustomer', 'is null']) {
      expect(shown).not.toContain(secret);
    }
  });

  // Read off the controllers that build these bodies: `DmsEntityFolderController.error(...)`, the
  // `invalidStatusResponse(...)` helpers, the inline date and window bodies in the order and
  // appointment controllers, and the two admin unauthorized bodies. Every one of them is short,
  // markup-free and marker-free, so gating the field costs none of them.
  it('still shows every curated sentence a codeless body actually carries', () => {
    const curated = [
      'businessId, type and entityId are all required',
      'businessId, billId and lineId are all required',
      'Valid statuses: PENDING, CONFIRMED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED',
      'Valid statuses: PENDING, CONFIRMED, COMPLETED, CANCELLED',
      'Date format should be YYYY-MM-DD (e.g., 2024-01-01)',
      'Expected YYYY-MM-DDTHH:mm:ss (e.g., 2025-04-24T14:30:00)',
      'Date window must be 90 days or fewer',
      'Invalid or missing X-API-Key',
    ];
    for (const reason of curated) {
      expect(extractErrorMessage(rejected(codeless(reason), 'axios'), 'fb')).toBe(reason);
    }
  });

  // The one knowing demotion. `parseBillStatuses` calls `BillStatus.valueOf`, and the JDK's
  // `IllegalArgumentException` for that names the enum's package and class. The controller's own
  // `message` says the same thing without the package, so the user loses the rejected value and
  // nothing else.
  it('demotes the enum-valueOf message to the controller label beside it', () => {
    const err = rejected(
      codeless(
        'No enum constant com.modulex.common.enums.BillStatus.SETTLED',
        'Invalid status filter',
      ),
      'Request failed with status code 400',
    );
    const shown = extractErrorMessage(err, 'Failed to load bills');
    expect(shown).toBe('Invalid status filter');
    expect(shown).not.toContain('com.modulex');
  });

  // The gate must not cost the codeless bodies their fall-through. Their `message` is a specific
  // literal, not the catch-all's constant label, so it is the best thing left when `error` is
  // refused — and better than the caller's fallback, which is why it is still reached.
  it('falls to the controller label before the axios line and the caller fallback', () => {
    const err = rejected(codeless(NGINX_502, 'Invalid date format'), 'Request failed', 400);
    expect(extractErrorMessage(err, 'Failed to load orders')).toBe('Invalid date format');
  });

  it('reaches the caller fallback when a codeless body has nothing usable at all', () => {
    const err = rejected(codeless(NGINX_502, '   '), '   ', 502);
    expect(extractErrorMessage(err, 'Failed to attach photo')).toBe('Failed to attach photo');
  });

  it('reports no code for a codeless body, whichever field won', () => {
    expect(extractErrorInfo(rejected(codeless('Invalid or missing X-API-Key')), 'fb')).toEqual({
      message: 'Invalid or missing X-API-Key',
    });
    expect(extractErrorInfo(rejected(codeless(NGINX_502)), 'fb')).toEqual({
      message: 'Entity folder request failed',
    });
  });

  // A wrapper WITH a code is gated by the same rules now, which is what the block below is for.
  // What stays true of a coded body is that the code still reaches the caller, and that the label
  // beside a refused field is still preferred to the caller's fallback.
  it('still reports the code and the label when a coded body is refused', () => {
    expect(extractErrorInfo(rejected(wrapper({ error: HELPFUL_NPE })), 'fb')).toEqual({
      code: 'INVALID_ARGUMENT',
      message: 'Invalid request data',
    });
  });
});

describe('body shapes', () => {
  // The three DMS services answer with a bare string body rather than the wrapper. Reading `.error`
  // off a string yields undefined, so without this branch every DMS failure shows the fallback.
  it('reads a body that is a bare string', () => {
    expect(extractErrorMessage(rejected('File not found'), 'fallback')).toBe('File not found');
  });

  it('prefers a bare-string body over the axios status line', () => {
    expect(extractErrorMessage(rejected('Folder is not empty', 'Request failed'), 'fb')).toBe(
      'Folder is not empty',
    );
  });

  // A binary endpoint (getMultipleResources) can reject with a body that is neither shape. The read
  // has to miss rather than throw a second error out of the catch block that called it.
  it('ignores a body that is neither string nor wrapper', () => {
    expect(extractErrorMessage(rejected(new ArrayBuffer(8), 'Network Error'), 'fb')).toBe(
      'Network Error',
    );
    expect(extractErrorMessage(rejected(42, 'Network Error'), 'fb')).toBe('Network Error');
    expect(extractErrorMessage(rejected(null, 'Network Error'), 'fb')).toBe('Network Error');
  });
});

// The bare-string branch was written for DMS's short reasons, but it now runs at ~59 ModuleX call
// sites too, where a string body means axios could not parse JSON — an nginx or Tomcat error page.
describe('a string body is only believed when it reads like a reason', () => {
  it('falls through an nginx 502 page to the axios status line', () => {
    const err = rejected(NGINX_502, 'Request failed with status code 502');
    const shown = extractErrorMessage(err, 'Failed to load orders');
    expect(shown).not.toContain('<');
    expect(shown).toBe('Request failed with status code 502');
  });

  it('falls through the other gateway pages the same way', () => {
    const pages = [
      '<html><head><title>413 Request Entity Too Large</title></head><body>' +
        '<center><h1>413 Request Entity Too Large</h1></center></body></html>',
      '<html><head><title>504 Gateway Time-out</title></head><body>' +
        '<center><h1>504 Gateway Time-out</h1></center></body></html>',
      '<!doctype html><html lang="en"><head><title>HTTP Status 500</title></head></html>',
    ];
    for (const page of pages) {
      const shown = extractErrorMessage(
        rejected(page, 'Request failed with status code 502'),
        'fb',
      );
      expect(shown).not.toContain('<');
      expect(shown).toBe('Request failed with status code 502');
    }
  });

  // Markup is not the only way a string body arrives unreadable. A proxy that answers in plain text
  // still hands over something no toast can hold.
  it('falls through a long markup-free dump to the axios status line', () => {
    const dump = `java.lang.NullPointerException at com.modulex.${'x'.repeat(400)}`;
    expect(extractErrorMessage(rejected(dump, 'Request failed with status code 500'), 'fb')).toBe(
      'Request failed with status code 500',
    );
  });

  // The shape the branch exists for. DMS answers with one short line and nothing else, so gating it
  // too hard would put every DMS failure back on the fallback.
  it('still uses a short bare-string reason', () => {
    expect(extractErrorMessage(rejected('File not found'), 'fallback')).toBe('File not found');
    expect(extractErrorMessage(rejected('Folder is not empty'), 'fallback')).toBe(
      'Folder is not empty',
    );
    expect(extractErrorMessage(rejected('  Unsupported file type\n'), 'fallback')).toBe(
      'Unsupported file type',
    );
  });

  it('takes a reason right up to the length bound and refuses the one past it', () => {
    const at = 'A'.repeat(200);
    const over = 'A'.repeat(201);
    expect(extractErrorMessage(rejected(at, 'Request failed'), 'fb')).toBe(at);
    expect(extractErrorMessage(rejected(over, 'Request failed'), 'fb')).toBe('Request failed');
  });

  // The bound is the same one the wrapper fields are held to. It used to apply only to the string
  // body, which let a 300-character `error` through on any code that was not the catch-all.
  it('holds the wrapper fields to the same bound', () => {
    const err = rejected(wrapper({ error: `Import failed on row ${'9'.repeat(300)}` }), 'axios');
    expect(extractErrorMessage(err, 'fb')).toBe('Invalid request data');
  });
});

// The bare-string branch used to run FIRST in the chain applying only `text()`, an `includes('<')`
// test and the length bound — no markers at all, because `curatedReason` was their only caller and
// it was reached later or not at all. So any bare string under the bound with no angle bracket in it
// won outright, ahead of every gate built for the wrapper. Each string below was executed against
// the real module by reviewers and reached the toast verbatim.
describe('a bare-string body is gated like every other candidate', () => {
  /** A string body on a 500, which is how each of these actually arrived. */
  function bare(body: string) {
    return rejected(body, 'Request failed with status code 500', 500);
  }

  it('refuses a unique-constraint dump and leaks neither the constraint nor the table', () => {
    const shown = extractErrorMessage(bare(CONSTRAINT_DUMP), 'Could not save this folder.');
    for (const secret of ['ERROR:', 'uk_folder_name', 'unique constraint', 'duplicate key']) {
      expect(shown).not.toContain(secret);
    }
  });

  it('refuses a helpful NPE and leaks neither the class nor the getter', () => {
    const shown = extractErrorMessage(bare(HELPFUL_NPE), 'Failed to open bill');
    for (const secret of ['com.modulex', 'getCustomer', 'Cannot invoke', 'is null']) {
      expect(shown).not.toContain(secret);
    }
  });

  // Sixteen characters that sound like an answer and are not, which is worse than the status line:
  // the user reads it, believes the system has told them something, and stops looking.
  it("refuses Optional's No value present", () => {
    expect(extractErrorMessage(bare('No value present'), 'Failed to load bills')).not.toContain(
      'No value present',
    );
  });

  // The worst of the five. An internal address is the one fragment here that is not merely
  // embarrassing — it names a host and a port to try.
  it('refuses a refused-connection string and publishes no host, port or scheme', () => {
    const shown = extractErrorMessage(bare(CONNECTION_REFUSED), 'Failed to attach photo');
    for (const secret of ['10.0.0.7', '8081', 'http://', 'I/O error', '/api/folders']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Request failed with status code 500');
  });

  // A half-parsed JSON fragment presented to the user as a sentence. Nothing but its opening brace
  // distinguishes it from a reason: it is short, single-line, markup-free and carries no marker any
  // other rule looks for.
  it('refuses a truncated JSON prefix rather than reading it out as prose', () => {
    const shown = extractErrorMessage(bare(TRUNCATED_JSON), 'Failed to load bills');
    for (const secret of ['{', '"success"', 'INTERNAL_ERROR', 'could not prepa']) {
      expect(shown).not.toContain(secret);
    }
  });

  // The branch still has to do its job. DMS answers with one short line and nothing else, and
  // gating it any harder would put every DMS failure back on the caller's fallback.
  it('still uses a genuine short DMS reason', () => {
    expect(extractErrorMessage(bare('File not found'), 'Could not open this file.')).toBe(
      'File not found',
    );
    expect(extractErrorMessage(bare('Folder is not empty'), 'fb')).toBe('Folder is not empty');
  });
});

// The gate used to run only when `code` was INTERNAL_ERROR or absent, so the other 21 codes handed
// `error` back through `text()` alone. INVALID_ARGUMENT is the hole that made this untenable: it is
// stamped on every IllegalArgumentException, which is as wide as the JDK's own precondition checks.
describe('the gate runs for every code, not only the unvouched ones', () => {
  it('refuses the enum-valueOf message an appointment POST produces', () => {
    const err = rejected(wrapper({ code: 'INVALID_ARGUMENT', error: ENUM_MESSAGE }));
    const shown = extractErrorMessage(err, 'Could not save this appointment.');
    expect(shown).not.toContain('com.modulex');
    expect(shown).not.toContain('AppointmentStatus');
    expect(shown).toBe('Invalid request data');
  });

  it('refuses the machine shapes on a code that is neither inverted nor the catch-all', () => {
    for (const dump of [HELPFUL_NPE, 'No value present', CONSTRAINT_DUMP, TRUNCATED_JSON]) {
      const shown = extractErrorMessage(
        rejected(wrapper({ code: 'VALIDATION', message: 'Validation failed', error: dump })),
        'fb',
      );
      expect(shown).toBe('Validation failed');
    }
  });

  // The claim that made uniform gating the right answer rather than merely the safe one: the
  // markers are built to pass prose and refuse machine text, so running them over the curated
  // strings of the message-first codes costs nothing. Checked against the Java rather than assumed.
  it('costs the message-first codes nothing', () => {
    const curated = [
      ['CONSTRAINT_VIOLATION', 'Related record missing or in use'],
      ['CONSTRAINT_VIOLATION', 'Data integrity violation'],
      ['OPTIMISTIC_LOCK', 'The record was modified by another user. Please refresh and try again.'],
    ] as const;
    for (const [code, message] of curated) {
      const err = rejected(wrapper({ code, message, error: RAW_POSTGRES }));
      expect(extractErrorMessage(err, 'fb')).toBe(message);
    }
  });

  // And nothing to the curated `error` values the error-first codes legitimately carry, including
  // the one built by the same helper as the inverted CONSTRAINT_VIOLATION.
  it('costs the error-first codes nothing', () => {
    const curated = [
      ['DUPLICATE_ENTRY', "A record with name 'Gold Facial' already exists"],
      ['NOT_FOUND', 'Order not found with id: 42'],
      ['ORDER_LOCKED', 'Order 42 is billed on bill 7'],
      ['INSUFFICIENT_STOCK', 'Only 3 units of Gold Facial left'],
      ['INVALID_ARGUMENT', 'Expiry date cannot be before manufacture date'],
      ['STATE_CONFLICT', 'Expense 42 is already reimbursed'],
      ['VALIDATION', 'quantity: must be positive'],
    ] as const;
    for (const [code, error] of curated) {
      expect(extractErrorMessage(rejected(wrapper({ code, error })), 'fb')).toBe(error);
    }
  });
});

/**
 * DMS-Backend's `ApiResponseWrapper` carries only success/message/data/error — there is no `code`
 * field on the class at all, and its `GlobalExceptionHandler` stamps none. So EVERY body from that
 * service is codeless, not the handful of hand-built ModuleX controller bodies the module used to
 * enumerate, and its `IOException` and `RuntimeException` handlers put a bare `ex.getMessage()` into
 * `error` — where `LocalStorageService` has already interpolated an absolute server path.
 */
describe('DMS-Backend, which stamps no code on any response', () => {
  /** An IOException body: a constant label, and a path in the field beside it. */
  function fileFailure(error: string, message = 'File operation failed') {
    return rejected(
      { success: false, message, data: null, error },
      'Request failed with status code 500',
      500,
    );
  }

  it('refuses an absolute POSIX path and leaks no part of the server layout', () => {
    const shown = extractErrorMessage(
      fileFailure(POSIX_PATH_REASON),
      'Could not rename this folder.',
    );
    for (const secret of ['/var', 'dms/storage', 'folders/12', '/']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Could not rename this folder.');
  });

  it('refuses an absolute Windows path the same way', () => {
    const shown = extractErrorMessage(
      fileFailure(WINDOWS_PATH_REASON),
      'Could not rename this folder.',
    );
    for (const secret of ['C:', '\\dms', 'storage']) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).toBe('Could not rename this folder.');
  });

  // The bare path with no sentence around it, which is what `Files.move` raises directly.
  it('refuses a NoSuchFileException whose whole message is the path', () => {
    for (const raw of ['/var/dms/storage/folders/12/photo.png', 'C:\\dms\\storage\\folders\\12']) {
      expect(extractErrorMessage(fileFailure(raw), 'Could not open this file.')).toBe(
        'Could not open this file.',
      );
    }
  });

  // The corrected rule. The comment this replaces kept a codeless body's `message` on the grounds
  // that it is "a specific literal, unlike the catch-all's constant 'An error occurred'" — which is
  // false for DMS, whose codeless catch-all uses exactly that constant and whose other nine labels
  // are constants too. Three of them say only that the request failed, which the user already knows
  // from seeing a toast at all; the caller's fallback at least names the operation.
  it('prefers the caller fallback to a label that restates the failure', () => {
    for (const label of ['An error occurred', 'Request failed', 'File operation failed']) {
      const shown = extractErrorMessage(
        fileFailure(POSIX_PATH_REASON, label),
        'Failed to attach photo',
      );
      expect(shown).toBe('Failed to attach photo');
      expect(shown).not.toBe(label);
      expect(shown).not.toBe('Request failed with status code 500');
    }
  });

  // The other seven name a cause category, which is more than the fallback's operation name alone,
  // so they are kept — as are the ModuleX controller literals riding the same codeless shape.
  it('keeps a label that names the cause', () => {
    const labels = [
      'Not found',
      'Method not allowed',
      'Missing request parameter',
      'Missing request part',
      'Invalid request parameter',
      'Invalid request',
      'Validation failed',
    ];
    for (const label of labels) {
      expect(extractErrorMessage(fileFailure(POSIX_PATH_REASON, label), 'fb')).toBe(label);
    }
  });

  // A short DMS reason has to survive all of this, or the gate has simply turned every DMS failure
  // into the caller's fallback and told the user nothing the toast did not already say.
  it('still uses a genuine short DMS reason on a codeless body', () => {
    for (const reason of ['File not found', 'Folder is not empty', 'Unsupported file type']) {
      expect(extractErrorMessage(fileFailure(reason), 'Could not open this file.')).toBe(reason);
    }
  });

  it('still uses the templated reasons the 4xx handlers build', () => {
    const templated = [
      "Required parameter 'folderId' (Integer) is missing",
      "Required part 'file' is missing",
      "Parameter 'folderId' expected type Integer but got 'abc'",
      'The folder Already Exists With Same Name.',
    ];
    for (const reason of templated) {
      expect(extractErrorMessage(fileFailure(reason, 'Invalid request'), 'fb')).toBe(reason);
    }
  });
});

describe('non-axios throws', () => {
  // A TypeError from our own mapping code arrives down the same catch as a rejected request. It has
  // no `response`, and touching `.response.data` unguarded would throw again from inside the catch.
  it('reads the message off an ordinary Error', () => {
    expect(extractErrorMessage(new TypeError('Cannot read properties of undefined'), 'fb')).toBe(
      'Cannot read properties of undefined',
    );
  });

  it('reads a network error that never got a response', () => {
    expect(extractErrorMessage({ message: 'Network Error', isAxiosError: true }, 'fb')).toBe(
      'Network Error',
    );
  });

  it('survives a throw that is not an object at all', () => {
    expect(extractErrorMessage(undefined, 'Failed to save')).toBe('Failed to save');
    expect(extractErrorMessage(null, 'Failed to save')).toBe('Failed to save');
    expect(extractErrorMessage('boom', 'Failed to save')).toBe('Failed to save');
    expect(extractErrorMessage(7, 'Failed to save')).toBe('Failed to save');
  });
});

describe('blank fields are absent fields', () => {
  // `||` already skipped `''`, but a whitespace-only field is truthy and would win — producing a
  // toast that opens, says nothing, and closes. That is indistinguishable from success.
  it('skips a whitespace-only error and uses the message', () => {
    expect(extractErrorMessage(rejected(wrapper({ error: '   ' })), 'fb')).toBe(
      'Invalid request data',
    );
  });

  it('skips blank fields all the way down to the fallback', () => {
    const err = rejected(wrapper({ error: '', message: '\n  \t' }), '  ');
    expect(extractErrorMessage(err, 'Failed to update batch')).toBe('Failed to update batch');
  });

  it('skips a whitespace-only string body', () => {
    expect(extractErrorMessage(rejected('   ', 'Network Error'), 'fb')).toBe('Network Error');
  });

  // The backend's reason strings sometimes arrive with a trailing newline, which pushes the toast
  // onto a second line for nothing.
  it('trims the message it keeps', () => {
    expect(
      extractErrorMessage(rejected(wrapper({ error: '  Batch already consumed\n' })), 'fb'),
    ).toBe('Batch already consumed');
  });

  // A numeric `error` must be skipped rather than stringified: "500" in a toast reads as a status
  // code leaking through, not as a reason.
  it('ignores non-string fields', () => {
    const err = rejected(wrapper({ error: 500, message: null }), '');
    expect(extractErrorMessage(err, 'Failed')).toBe('Failed');
  });
});

describe('the message is never empty', () => {
  // The whole point of the module. Every one of these has been thrown at a catch block somewhere,
  // and any of them returning '' is a failed write that the user reads as a success.
  const nothings: unknown[] = [
    undefined,
    null,
    '',
    0,
    {},
    [],
    new Error(''),
    { message: '   ' },
    { response: null },
    { response: { data: null } },
    { response: { data: '' } },
    { response: { data: '   ' } },
    { response: { data: {} }, message: '' },
    { response: { data: { error: '', message: '  ' } }, message: '\t' },
    // The two shapes the gate and the branch can now reject outright — neither may leave the user
    // with an empty toast on the way out.
    { response: { data: NGINX_502 }, message: '' },
    { response: { data: '<' }, message: '   ' },
    { response: { data: { code: 'CONSTRAINT_VIOLATION', message: '', error: '' } }, message: '' },
    { response: { data: { code: 'OPTIMISTIC_LOCK' } }, message: '\n' },
    // The catch-all deliberately walks past its own label and past the status line, so it reaches
    // the end of the chain more often than any other code. The guarantee has to hold there too.
    {
      response: {
        data: { code: 'INTERNAL_ERROR', message: 'An error occurred', error: NGINX_502 },
      },
      message: '',
    },
    { response: { data: { code: 'INTERNAL_ERROR', error: HELPFUL_NPE } }, message: '   ' },
  ];

  it.each(nothings)('returns a usable string for %p', (err) => {
    const message = extractErrorMessage(err, 'Failed to delete');
    expect(typeof message).toBe('string');
    expect(message.trim().length).toBeGreaterThan(0);
  });

  // A caller passing a blank fallback is a bug, but it must not become the user's problem.
  it('still returns something when the fallback itself is blank', () => {
    expect(extractErrorMessage({ response: { data: {} } }, '   ').trim().length).toBeGreaterThan(0);
  });
});

describe('extractErrorInfo', () => {
  // useModuleService returns `{ success: false, code, error }` and its screens branch on the code,
  // so dropping it here would silently flatten every typed failure into an untyped one.
  it('returns the wrapper code alongside the message', () => {
    expect(extractErrorInfo(rejected(wrapper()), 'fb')).toEqual({
      code: 'INVALID_ARGUMENT',
      message: 'Batch already consumed',
    });
  });

  it('omits the code when the body has none', () => {
    expect(extractErrorInfo(rejected('File not found'), 'fb').code).toBeUndefined();
    expect(extractErrorInfo(new Error('boom'), 'fb').code).toBeUndefined();
    expect(extractErrorInfo(rejected(wrapper({ code: '  ' })), 'fb').code).toBeUndefined();
  });

  it('reports a code even when the reason had to come from the fallback', () => {
    const err = rejected(wrapper({ error: null, message: null }), '');
    expect(extractErrorInfo(err, 'Failed to load')).toEqual({
      code: 'INVALID_ARGUMENT',
      message: 'Failed to load',
    });
  });

  it('agrees with extractErrorMessage', () => {
    const err = rejected(wrapper());
    expect(extractErrorInfo(err, 'fb').message).toBe(extractErrorMessage(err, 'fb'));
  });
});
