/**
 * The human reason a request failed, pulled off whatever was thrown.
 *
 * Kept RN-free — import-free, in fact — so the repo's plain-node jest can cover it, the same reason
 * `refreshCoordinator.ts` sits next door. Nothing here touches axios at runtime: the input is
 * `unknown` and the shape is read structurally, because a good share of the throws reaching these
 * call sites are not axios errors at all. A TypeError from our own mapping code and a `new Error`
 * from a service's own argument check both arrive down the same catch.
 *
 * ModuleX answers every handled failure with a wrapper carried on a NON-2xx response, so axios
 * rejects and the body lands at `err.response.data`:
 *
 *     { success: false, code: 'INVALID_ARGUMENT', message: 'Invalid request data', error: '<reason>' }
 *
 * `message` there is a fixed label the exception handler stamps on everything; `error` carries the
 * sentence that actually tells the user what to fix. That is why `error` wins by default, and it is
 * the order the hand-rolled copies of this logic already use across business, person, auth,
 * dashboard, tab-config, dms and useModuleService. Two server codes build the wrapper the other way
 * round; both are named and explained under `MESSAGE_FIRST_CODES`.
 *
 * The chain is:
 *
 *     reason(bare-string body)      // the whole body was a string, not a wrapper
 *       ?? reason(preferred field)  // `error`, or `message` for the two inverted codes
 *       ?? reason(secondary field)  // the other field, dropped if it is a contentless constant
 *       ?? statusLine               // axios's own message, only when the wrapper said nothing
 *       ?? caller fallback
 *       ?? LAST_RESORT
 *
 * EVERY server-supplied term in that chain goes through the one gate, `reason`. That uniformity is
 * the correction of two escapes found in review. The first: the bare-string branch used to apply
 * only a markup test and a length bound, no markers — and being FIRST in the chain, any bare string
 * under the bound with no angle bracket in it won outright, ahead of every gate built for the
 * wrapper. A bare-string body is not more trustworthy than a stamped field, it is less: nothing
 * vouched for it, and axios only leaves the body a string when it could not even parse it as JSON.
 * The second: the gate used to run only when `code` was `INTERNAL_ERROR` or absent, so the other 21
 * codes handed `error` back untouched — and `INVALID_ARGUMENT` is as wide as
 * `IllegalArgumentException` itself. See `reason` for what the uniform gate was checked against.
 *
 * The one term deliberately left ungated is `statusLine`, which reads `err.message`. No server text
 * can reach it: axios builds that string itself ("Request failed with status code 500", "Network
 * Error", "timeout of 4000ms exceeded") and never copies the response body into it, so the leaks
 * this module exists to stop have no route there. What else lands on it is our own JS throws, whose
 * text names our own variables rather than the backend's schema, hosts or disks.
 *
 * The returned message is guaranteed non-empty. A blank one is the worst available outcome: a
 * delete that failed with no message is a delete the user believes succeeded, because all they see
 * is an empty toast and a row that is somehow still there.
 */

/** Used only when the caller's own fallback is blank too, so the guarantee cannot be talked out of. */
const LAST_RESORT = 'Something went wrong. Please try again.';

/**
 * The codes whose wrapper is inverted: `message` holds the curated sentence and `error` holds text
 * the user must never read. Derived by reading every `ApiResponseWrapper` built in ModuleX's
 * `GlobalExceptionHandler` — 23 code/message pairings, of which only these two invert.
 *
 * CONSTRAINT_VIOLATION is built by `integrityBody(...)` on the non-duplicate branch, where `error`
 * is `ex.getMostSpecificCause().getMessage()` — the raw PostgreSQL text. Reading `error` first put
 * `ERROR: update or delete on table "parlour_order" violates foreign key constraint
 * "fk_bill_order_id" ... Key (id)=(42) is still referenced` into a toast: unreadable, and it hands
 * table names and primary keys to whoever is holding the phone. `message` is the half written for a
 * person ("Related record missing or in use" on the FK branch, "Data integrity violation" on the
 * rest).
 *
 * OPTIMISTIC_LOCK puts "The record was modified by another user. Please refresh and try again." in
 * `message` and the bare label "Concurrent modification detected" in `error`. Error-first discarded
 * precisely the half that tells the user what to do about it.
 *
 * This must stay a branch and not become a global flip: DUPLICATE_ENTRY comes out of the SAME
 * `integrityBody` helper laid out the usual way ("Duplicate entry" in `message`, "A record with
 * name 'X' already exists" in `error`), so inverting everything would trade a specific, actionable
 * conflict for two useless words.
 *
 * Note what this set does NOT decide any more: whether the winning field is gated. Both fields of
 * every code are, inverted or not.
 */
const MESSAGE_FIRST_CODES: ReadonlySet<string> = new Set([
  'CONSTRAINT_VIOLATION',
  'OPTIMISTIC_LOCK',
]);

/**
 * Constants a handler stamps into `message` that restate "the request failed" and nothing else.
 *
 * These are the exact strings — matched whole, because a curated sentence can only collide with one
 * by being character for character identical — that three catch-all handlers write:
 * ModuleX's `@ExceptionHandler(Exception.class)` writes "An error occurred", and DMS-Backend's
 * `RuntimeException`, `IOException` and `Exception` handlers write "Request failed", "File
 * operation failed" and "An error occurred" respectively.
 *
 * The rule they drive: when the gate refuses the `error` beside one of these, the label is NOT the
 * best thing left — the caller's fallback is. Every call site passes one, and they read "Could not
 * delete this product.", "Failed to load orders", "Could not save this batch.": the screen's own
 * sentence, which names what the user was doing when it broke. A label that names neither the
 * operation nor the cause loses to one that names the operation.
 *
 * This replaces a `code === 'INTERNAL_ERROR'` branch that used to carry the same rule, and the
 * comment that justified keeping the secondary on a codeless body "because its message is a
 * specific literal, unlike the catch-all's constant". That justification was false, and DMS is
 * where it broke: DMS's `ApiResponseWrapper` has no `code` field AT ALL — only
 * success/message/data/error — and its `GlobalExceptionHandler` stamps none, so EVERY DMS error
 * body is codeless, not just the dozen hand-built ModuleX controller bodies. Reading DMS's ten
 * handlers in order, every one of its `message` values is a constant too, three of them these.
 * Keying the rule on the code therefore missed exactly the backend that needed it, and keying it on
 * "codeless bodies have specific literals" asserted something untrue of an entire service.
 *
 * Keying it on the string itself is what makes it right in both places at once, and it is why the
 * remaining seven DMS labels stay: "Validation failed", "Invalid request", "Missing request
 * parameter", "Missing request part", "Invalid request parameter", "Method not allowed" and "Not
 * found" each name a cause category, which is more than the fallback's operation name alone. So do
 * the ModuleX controller literals that ride the same codeless shape ("Invalid status filter",
 * "Invalid date format", "Entity folder request failed", "Unauthorized").
 */
const CONTENTLESS_LABELS: ReadonlySet<string> = new Set([
  'An error occurred',
  'Request failed',
  'File operation failed',
]);

/**
 * The JDK 21 helpful-NPE shape (JEP 358), which no `throw` in ModuleX produces.
 *
 * Two nets, because either alone has a hole. The JVM builds these messages from a fixed opener that
 * names the failed bytecode and a fixed tail that names the null receiver. The eight openers are
 * `Cannot invoke`, `Cannot read field`, `Cannot assign field`, `Cannot read the array length`,
 * `Cannot load from … array`, `Cannot store to … array`, `Cannot enter synchronized block` and
 * `Cannot throw exception`; the alternation also carries `exit`, the monitorexit spelling of the
 * synchronized-block one. Matching only `Cannot invoke "` and `Cannot read field "` — the two this
 * list carried first — let the other six straight through, because `MACHINE_TEXT_MARKERS`'s
 * fully-qualified-name rule only backstops them when the quoted receiver happens to be a qualified
 * name; for a local, a parameter or a plain field (`because "line" is null`) it does not fire.
 *
 * The tail is the wider net: every JEP-358 message, whatever its opener, ends `because <receiver> is
 * null`, where the receiver is a quoted name or the phrase `the return value of "…"`. It is also the
 * only net that survives nesting — `DmsEntityFolderController` hands back `"DMS folder creation
 * failed: " + e.getMessage()`, which puts the JVM's sentence in the middle of someone else's.
 *
 * Checked against every ModuleX string literal beginning `Cannot ` and every one containing
 * `because`. Neither rule touches any of them: the openers stop at `Cannot remove`, `Cannot delete`,
 * `Cannot instantiate`, `Cannot record`, `Cannot transition`, `Cannot activate`, `Cannot un-accept`,
 * none of which is a bytecode verb; and the curated sentences that do say `because` — the
 * order/appointment lock message and the batch-delete message — end on a full stop rather than on
 * `is null`, which is why the tail rule is anchored.
 */
const HELPFUL_NPE_MARKERS: readonly RegExp[] = [
  /^Cannot (?:invoke|read|assign|load from|store to|enter|exit|throw)\b/,
  /\bbecause\b.*\bis null$/,
];

/**
 * The JDK's own canned exception text — short, free of markers, and worse than the caller's
 * fallback.
 *
 * `GlobalExceptionHandler` has no handler for `NoSuchElementException`,
 * `IndexOutOfBoundsException`, `ArithmeticException` or `DateTimeParseException`, so each reaches
 * `@ExceptionHandler(Exception.class)` and its raw `getMessage()` becomes the toast. Every other
 * rule in this module keys off SQL, Hibernate or class-name shape, and these carry none: `No value
 * present` is sixteen characters of nothing, and it sounds enough like an answer that the user stops
 * looking. "Failed to load orders" at least names what broke.
 *
 * All of them are `String.format`ed by the JDK from a constant template, so anchoring the whole
 * string is safe — a curated sentence cannot collide with one by accident, only by being character
 * for character identical. Taken from the JDK 21 sources rather than from memory of the symptoms:
 * `Optional`, `Preconditions.outOfBounds*` (which formats for `Objects.checkIndex`, arrays,
 * `ArrayList` and `String` alike), the older `Index: n, Size: n` spelling `LinkedList` and
 * `AbstractList` still use, `Array`/`String index out of range`, `String`'s
 * `begin/end/length` form, the `ArithmeticException` constants including the two `BigDecimal`
 * division ones a money backend can actually hit, `DateTimeParseException`'s three spellings, and
 * `Collectors.toMap`'s duplicate-key message, which prints two `toString()`s and their identity
 * hashes.
 *
 * `NumberFormatException`'s `For input string: "…"` is deliberately absent, and it is the one entry
 * whose reasoning the uniform gate changed. It is an `IllegalArgumentException`, so it is stamped
 * INVALID_ARGUMENT rather than reaching the catch-all — which used to mean adding it here would
 * guard nothing, because that code was ungated. Now that every code is gated the entry would in
 * fact bite, and it is still left out on its merits: `For input string: "abc"` names no internal and
 * reads as an answer, so it is worth more to the user than "Failed to load orders". Same reason
 * `DateTimeException`'s `Invalid value for MonthOfYear (valid values 1 - 12): 13` is absent.
 */
const JDK_MESSAGE_MARKERS: readonly RegExp[] = [
  /^No value present$/,
  /^Index -?\d+ out of bounds for length -?\d+$/,
  /^Index: -?\d+, Size: -?\d+$/,
  /^Range \[-?\d+, -?\d+(?: \+ -?\d+)?\) out of bounds for length -?\d+$/,
  /^(?:Array|String) index out of range: -?\d+$/,
  /^begin -?\d+, end -?\d+, length -?\d+$/,
  /^(?:\/ by zero|Division by zero|Division undefined|BigInteger divide by zero|Rounding necessary|integer overflow|long overflow|Non-terminating decimal expansion; no exact representable decimal result\.)$/,
  /^Text '[^']*' could not be parsed\b/,
  /^Duplicate key .* \(attempted merging values .* and .*\)$/,
];

/**
 * Spring's two `RestTemplate` failure templates, which carry the far side's response INTO our body.
 *
 * `DmsClient` calls `restTemplate.exchange` with no try/catch, so whatever
 * `DefaultResponseErrorHandler` raises travels up to `DmsEntityFolderController`'s
 * `catch (RuntimeException e)` and is re-emitted as `"DMS folder creation failed: " +
 * e.getMessage()`. Spring 6.2 builds that message as `<status> <statusText>: "<body preview>"`, so a
 * DMS failure behind nginx puts the gateway's own `<html>…nginx/1.24.0…</html>` document inside our
 * `error` field — the leak the markup test exists to stop, arriving on a JSON body rather than as a
 * string. A connection that is refused rather than answered raises `ResourceAccessException`
 * instead, whose template is `I/O error on POST request for "http://<internal-host>:<port>/…":
 * Connection refused` — an internal hostname and port, in a toast, on a phone.
 *
 * The markup check in `reason` already stops the HTML case; these two stop the previews and the
 * connection-refused case it cannot see. Both are unanchored because the controller's prefix puts
 * them mid-string, while a `RestClientException` that escapes to the catch-all instead arrives with
 * the same shape at the front — unanchored is the only form that covers both routes.
 *
 * `LOCATOR_MARKERS` now catches the address inside that connection-refused string independently, on
 * purpose: this rule matches Spring's exact phrasing, and phrasing is the part that changes between
 * versions and between the two hops the same failure can take.
 */
const TRANSPORT_MESSAGE_MARKERS: readonly RegExp[] = [
  /\bI\/O error on \w+ request for "/,
  /\b[1-5]\d\d [A-Za-z][A-Za-z' -]*: "/,
];

/**
 * Text that names a place on our infrastructure rather than a thing in the user's data: a file on a
 * server's disk, or a host to connect to. This is the most sensitive class in the module — a schema
 * dump describes the database, but an address invites someone to it.
 *
 * Written for DMS-Backend, which produces both and stamps no code on anything, so nothing upstream
 * classifies these before they arrive:
 *
 * - `LocalStorageService` throws messages that unconditionally interpolate an absolute path —
 *   `"Source folder does not exist: " + oldPath`, `"Target folder already exists: " + newPath`,
 *   `"File not found or unreadable: " + storagePath`, `"Failed to delete file: " + storagePath`.
 *   The first two are `IOException`s, so they land on the handler that writes "File operation
 *   failed" into `message` and the bare `ex.getMessage()` into `error`; the other two are
 *   `RuntimeException`s and get "Request failed". Underneath them, `Files.move` and
 *   `Files.createDirectories` raise `NoSuchFileException` and `FileSystemException`, whose
 *   `getMessage()` is the path alone or `<source> -> <target>: <reason>` — no sentence around it at
 *   all, which is why the path rules cannot assume a prefix and must match the path anywhere.
 * - The connection-refused string quoted in `TRANSPORT_MESSAGE_MARKERS` publishes an internal
 *   hostname and port. That one arrives at the client as a bare string body, which is the route
 *   that used to bypass every marker in this file.
 *
 * Shapes, and why each is drawn the way it is:
 *
 * - A POSIX path is an unbroken run of `/segment/` that STARTS a token. Requiring the leading slash
 *   to sit at the start of the string or after whitespace, a colon, a quote or a bracket is what
 *   keeps prose out: "Record a wastage/transfer or change its status instead." and "I/O error" both
 *   have their slash mid-word, and the "(use reason=CORRECTION to adjust an ON_HOLD / QUARANTINED
 *   batch …)" message has a lone slash with spaces around it and no second segment.
 * - A Windows path is a drive letter, a colon and a separator. It is checked even though the server
 *   runs Linux, because the same service is run on a developer's machine against a real client and
 *   the message travels unchanged; the colon-then-separator pair is what keeps a clock time out of
 *   it ("Expected YYYY-MM-DDTHH:mm:ss" has the colon and no separator after it).
 * - A URL is any `scheme://host`, not merely the `host:port` of the motivating string. An internal
 *   hostname with the port left off is the same disclosure with one fewer detail, and refusing the
 *   wider shape costs nothing measurable: no exception message string in either ModuleX or
 *   DMS-Backend contains `://` at all.
 *
 * The knowing cost, checked rather than assumed by running the gate over both backends' curated
 * strings. Three are refused, all of them for naming a REQUEST path, which is indistinguishable
 * from a filesystem path and is refused with them:
 *
 * - DMS's `NoResourceFoundException` handler writes `"No endpoint for " + method + " /" + path`.
 *   The user gets that body's "Not found" instead, losing which endpoint 404'd — a fact for a
 *   developer reading a log, not for a person holding a phone.
 * - `DmsClient` in ModuleX throws `"DMS /folder/ensure failed for '<name>' under parent <id>: "` and
 *   `"DMS /folder/rename failed for folder <id> -> '<name>': "`, each ending in the DMS wrapper's
 *   own `error` field. Losing these is a gain, not a cost: that tail is the very field
 *   `LocalStorageService` fills with absolute paths, so the string is a CARRIER for the leak rather
 *   than a victim of the rule. The endpoint name it also publishes is internal API surface.
 */
const LOCATOR_MARKERS: readonly RegExp[] = [
  /(?:^|[\s:="'([])\/[\w.-]+\/[\w.-]/,
  /(?:^|[\s:="'([])[A-Za-z]:[\\/][\w.-]/,
  /[A-Za-z][A-Za-z\d+.-]*:\/\/[^\s/]/,
];

/**
 * Text that proves a field came from a machine rather than from a `throw` someone wrote. Each entry
 * was taken from what this stack — PostgreSQL 42.6 driver, Hibernate 6.6, Spring Framework 6.2
 * (Boot 3.4.2), Java 21 — actually emits, not from guesswork:
 *
 * - `ERROR:` prefixes every message PostgreSQL's server sends, and both Hibernate and Spring embed
 *   that text verbatim inside their own. It is the carrier for column, table and constraint names.
 * - A bracketed DML keyword is how the statement itself gets attached: Hibernate 6.6 appends
 *   `[select b1_0.id,…]` to `could not prepare statement`, Spring 6.2 writes `JDBC exception
 *   executing SQL [update …]`, and `BadSqlGrammarException` reads `bad SQL grammar [select …]`.
 *   Matching the bracket rather than the word "SQL" is what covers all three spellings.
 * - A fully-qualified Java name is the shape of every class this backend would rather not name:
 *   `com.modulex.parlour.entity.Bill` in a helpful NPE or a `LazyInitializationException` proxy,
 *   `org.postgresql.util.PSQLException` in a nested cause, `java.time.LocalDate` in a Jackson parse
 *   error. Requiring a known package root plus two more dotted segments is what keeps a sentence
 *   that merely mentions a domain out of the net.
 * - An interior newline belongs to a dump: PostgreSQL hangs `\n  Position: 8` and `\n  Detail: …`
 *   off its errors, and stack traces are newline-separated. `text()` has already trimmed the ends,
 *   so anything left is structure, and no curated one-line throw contains one.
 * - A leading `{` or `[` is a serialized object, and the reason it is here is a body that arrived
 *   as `{"success":false,"code":"INTERNAL_ERROR","message":"An error occurred","error":"could not
 *   prepa` — a response truncated mid-write, which axios could not parse and therefore handed over
 *   as a string. It carries no other marker: the `ERROR:` rule wants a colon that the quoted
 *   `"INTERNAL_ERROR"` does not have, and it fits inside the length bound. Presented as a sentence
 *   it is gibberish; the shape is the only thing that gives it away.
 *
 * The trade is deliberate and is the price of not leaking internals: a genuine sentence that happens
 * to carry a marker is demoted along with the dumps. "Invalid business type: ERROR:" would be
 * refused. So would a `No Persons Were Found with ID's: […]` whose id list runs past the length
 * bound. Those cost the user one detail; a column list costs them the whole message and hands the
 * database's shape to whoever is holding the phone.
 *
 * The four grouped lists are appended rather than inlined so each keeps the evidence it was derived
 * from next to it; the gate reads the concatenation and does not care about the grouping.
 */
const MACHINE_TEXT_MARKERS: readonly RegExp[] = [
  /\bERROR:/,
  /\[\s*(?:select|insert|update|delete)\b/i,
  /\b(?:com|org|net|io|java|javax|jakarta)\.[a-z0-9_]+\./,
  /[\r\n]/,
  /^[{[]/,
  ...HELPFUL_NPE_MARKERS,
  ...JDK_MESSAGE_MARKERS,
  ...TRANSPORT_MESSAGE_MARKERS,
  ...LOCATOR_MARKERS,
];

/**
 * How long a server-supplied string may be and still be believed to be a sentence a person wrote.
 *
 * One bound for every term, because the two it replaced were both 200 and both chosen the same way.
 * The longest hand-written text reaching any of these routes is a short line plus an interpolated
 * id: every `throw` literal in ModuleX resolves to at most 157 characters ("A pharmacy product
 * cannot be both Prescription-Required and Over-the-Counter (OTC) at the same time. Set only one of
 * isPrescriptionRequired or isOTC to true."), the DMS reasons this gate must not cost anything are
 * shorter still ("File not found", "Folder is not empty"), and the longest codeless controller
 * literal is "Valid statuses: PENDING, CONFIRMED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED" at
 * 79. A Hibernate message carries a whole SELECT list and runs into four figures. Anything between
 * the two is a dump with the markers filed off, and refusing it costs only the caller's fallback.
 *
 * The bound is not sufficient on its own, which is why `reason` runs the markup test alongside it:
 * an nginx error page is only ~160 characters and slips under the bound untouched.
 */
const MAX_REASON = 200;

export interface ApiErrorInfo {
  /** Always non-empty. */
  message: string;
  /** The wrapper's machine-readable code, when the body carried one. */
  code?: string;
}

/**
 * A field counts as present only when it holds visible text.
 *
 * `||` already skipped `''`, but not `'   '` — and a whitespace-only `error` field surfaces as a
 * toast with nothing in it, which is the precise failure this module exists to prevent. Trimming
 * the value we keep matters for the same reason: the backend's reason strings sometimes arrive with
 * a trailing newline, which pushes the toast to two lines for no visible gain.
 */
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The one shape gate. Every server-supplied candidate for the returned message passes through here
 * — the bare-string body and both wrapper fields, for every code — because the code alone cannot
 * tell a curated `throw new RuntimeException("No Appointments Found")` from a
 * `NullPointerException` that reached the same handler by accident, and the field name cannot
 * either.
 *
 * Three tests plus the markers, each catching what the others miss:
 *
 * - Markup, which is load-bearing for the string-body route: every gateway page opens a tag, and
 *   nginx's 502 body is only ~160 characters, so the length bound alone would wave it through. It
 *   is checked on the wrapper fields too, because a JSON string routinely HOLDS an HTML document:
 *   Spring 6.2 quotes a preview of the far side's response into its own exception message, and
 *   `DmsEntityFolderController` copies that message into `error`.
 * - The length bound, which catches dumps carrying no markup at all — a plain-text stack trace, a
 *   proxy's diagnostic blob.
 * - `MACHINE_TEXT_MARKERS`, which catches the short, well-formed, markup-free ones: a helpful NPE, a
 *   canned JDK string, a filesystem path, an internal URL.
 *
 * Applying the markers to EVERY code was verified rather than assumed, by running the gate over the
 * curated corpus of both backends: all 202 distinct realized `throw` strings in ModuleX (its 15
 * exception types plus its bare `RuntimeException`s, with interpolated ids substituted), the 23
 * `message` constants its `GlobalExceptionHandler` stamps, and DMS-Backend's 10 labels and 5
 * templated `error` values. It costs the message-first codes nothing ("Related record missing or in
 * use", "Data integrity violation", "The record was modified by another user. Please refresh and
 * try again."), and it costs the error-first codes nothing either ("A record with name 'Gold
 * Facial' already exists", "Order not found with id: 42", "Order 42 is billed on bill 7"). Two
 * curated strings are knowingly demoted, both named where their rule is defined: DMS's "No endpoint
 * for GET /folder/view" under `LOCATOR_MARKERS`, and a `MethodArgumentNotValidException` field-error
 * list long enough to pass 200 characters — which is a generated `field: constraint; field: …` join
 * rather than a sentence, and is past what a toast can hold either way.
 *
 * What it stops is `INVALID_ARGUMENT`, which is the whole reason the gate had to become uniform:
 * that code is as wide as `IllegalArgumentException` itself. `AppointmentMapper.toEntity` and
 * `toShallowEntity` both call `AppointmentStatus.valueOf(dto.getAppointmentStatus())` with no
 * try/catch, reached inline from the appointment POST and PUT controllers, so a client sending an
 * unknown status got `No enum constant com.modulex.common.enums.AppointmentStatus.X` stamped
 * INVALID_ARGUMENT and read it verbatim in a toast.
 */
function reason(value: unknown): string | undefined {
  const candidate = text(value);
  if (candidate === undefined) return undefined;
  if (candidate.includes('<')) return undefined;
  if (candidate.length > MAX_REASON) return undefined;
  if (MACHINE_TEXT_MARKERS.some((marker) => marker.test(candidate))) return undefined;
  return candidate;
}

/** The wrapper's fields, all `unknown` because nothing has validated the body at this point. */
interface ErrorBody {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

/**
 * Message plus code, for callers whose result contract carries both — `useModuleService` returns
 * `{ success: false, code, error }` and its screens branch on the code.
 */
export function extractErrorInfo(err: unknown, fallback: string): ApiErrorInfo {
  // Every hop is optional-chained off a cast rather than type-guarded, because `err` is genuinely
  // anything: a rejected non-Error, a string, `undefined` from a bare `throw`. Optional chaining
  // makes each of those miss instead of throw a second error out of the catch block.
  const source = err as { response?: { data?: unknown } | null; message?: unknown } | null;
  const data = source?.response?.data;

  // DMS is the one backend whose error bodies are sometimes a bare string instead of the wrapper,
  // which is why its three services each grew this branch. Keeping it here is what lets them drop
  // their private copies rather than keep one for this single shape.
  const body: ErrorBody | undefined =
    typeof data === 'object' && data !== null ? (data as ErrorBody) : undefined;

  const code = text(body?.code);

  // Only which of the two fields is asked FIRST changes. The loser stays in the chain directly
  // behind the winner, so a wrapper whose preferred field came back blank still shows the server's
  // other field rather than skipping both for axios's status line.
  const inverted = code !== undefined && MESSAGE_FIRST_CODES.has(code);
  const preferredField = inverted ? body?.message : body?.error;
  const secondaryField = inverted ? body?.error : body?.message;

  // The secondary is whichever field lost. For the 21 ordinary codes that is the handler's label,
  // which sails through the gate — every label in both backends is a short constant — so the only
  // thing that removes it is being one of the three that say nothing the user does not already
  // know. For the two inverted codes it is the raw driver text instead, and there the gate is what
  // stops a wrapper whose curated `message` came back blank from falling through onto a PostgreSQL
  // dump.
  const label = reason(secondaryField);
  const usableLabel = label !== undefined && !CONTENTLESS_LABELS.has(label) ? label : undefined;

  // axios's own message is a restatement of the HTTP status, so it is worth showing only when the
  // server said nothing else at all. If the wrapper DID carry text in a field we consulted and we
  // refused it, "Request failed with status code 500" adds nothing the refused body had not already
  // implied, while the caller's fallback names the operation — so the chain skips straight to it.
  // A refused bare-STRING body is the opposite case and deliberately still falls through to the
  // status line: a string body means axios could not parse JSON, so no structured error was sent
  // and the status is genuinely the only classification anyone has.
  const wrapperSpoke = text(preferredField) !== undefined || text(secondaryField) !== undefined;
  const statusLine = wrapperSpoke ? undefined : text(source?.message);

  const message =
    reason(data) ??
    reason(preferredField) ??
    usableLabel ??
    statusLine ??
    text(fallback) ??
    LAST_RESORT;

  return code ? { message, code } : { message };
}

/**
 * The message alone — what almost every call site wants.
 *
 * Named to match the private `extractErrorMessage` these services already call, so adopting it is a
 * matter of deleting the private copy and importing this one.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  return extractErrorInfo(err, fallback).message;
}
