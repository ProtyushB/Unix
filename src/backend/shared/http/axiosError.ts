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
 * The one term still ungated is `statusLine`, which reads `err.message`. The claim that used to sit
 * here — that no server text can reach that property, because axios writes it itself and never
 * copies the body into it — was false, and it was false about our own code rather than about axios.
 * Four places READ a wrapper and re-threw the field they read: 16 sites in `useModuleService`
 * spelling it `throw new Error(response.error || response.message || '<fallback>')`,
 * `auth.service`'s `handleApiError` spelling it `new Error(data.error)`, and the `unwrap` helper
 * copied into `file.api.impl` and `folder.api.impl` spelling it `new Error(wrapper.error || …)`. A
 * plain `Error` keeps the sentence and drops the envelope, so the extractor was handed a message
 * with no `response.data` behind it, every marker list was skipped for want of anything to inspect,
 * and `statusLine` handed the text straight back. That is how a foreign-key dump naming a table and
 * a live key, a helpful NPE naming `com.modulex.parlour.entity.Bill`, an absolute `/var/dms/...`
 * path and an internal `http://host:port` each reached a toast verbatim while the identical text on
 * a wrapper was being correctly demoted.
 *
 * A larger set of sites never threw at all: they read the same HTTP-200 wrapper in an `else` branch
 * and put its text on screen directly, so nothing in this module ran for them in the first place.
 * `apiMessage` is the door built for those — the same gate, entered with no error to wrap.
 *
 * `useModuleService`'s 39 go through it. Eighteen more do not, and naming them is worth more here
 * than a sentence that sounds finished: `person.service` (11 sites), `business.service` (5) and
 * `dashboard.service` (2) each end a refusal with `response.error || response.message`, ungated.
 * `CustomersScreen` and `useCustomerPicker` put that field on screen directly, so a constraint
 * violation on the person routes still reaches a user. They are deliberately left for a separate
 * change, because sixteen of them pass no fallback at
 * all — the field is `undefined` whenever the wrapper is empty, and `actionOutcome` documents the
 * screens whose `if (!result.success && result.error)` guard turns on exactly that. Sending them
 * through here would make the field always non-empty and flip those guards, which is a decision
 * about what a screen shows rather than about message safety, and it needs a fallback literal
 * chosen per site.
 *
 * What makes `statusLine` safe now is not that server text cannot arrive but that it cannot WIN.
 * Those sites throw `ApiError`, which carries the wrapper at `response.data` alongside the message,
 * and `statusLine` is consulted only when neither wrapper field held visible text. Whenever
 * `err.message` was built FROM a wrapper field, that same non-blank field is in the body, so
 * `wrapperSpoke` is true and the chain never reaches the status line — the case where `err.message`
 * holds server text is exactly the case where `statusLine` is skipped.
 *
 * So what still lands on `statusLine`, re-derived after those conversions rather than carried over
 * from before them, is four things:
 *
 * - axios's own strings ("Request failed with status code 500", "Network Error", "timeout of 4000ms
 *   exceeded"), including the copy `auth.service` re-throws as `new Error(axiosError.message)` when
 *   there was no body to attach to.
 * - our own JS throws: the argument guards in the module and DMS services ("Quantity must be more
 *   than zero", "fileId is required"), `ensureBusinessDmsFolders`'s two failures, and a TypeError
 *   out of our own mapping code. Their text names our variables and our copy, not the backend's
 *   schema, hosts or disks.
 * - an `ApiError` whose body said nothing at all, whose message is then the caller's own fallback
 *   literal.
 * - a message THIS module already gated, flattened back onto a plain `Error`. `DmsService`,
 *   `FileService` and `FolderService` each end `handleApiError` with
 *   `new Error(extractErrorMessage(error, 'An unexpected DMS error occurred'))`, and
 *   `useModuleService` awaits those services inside try blocks whose catch runs
 *   `extractErrorMessage` a second time. The second run re-gates nothing — it reads the string off
 *   `.message` and hands it back — so what makes this one safe is only that it went through
 *   `reason` on the first pass. It is the single category here that is safe by history rather than
 *   by construction, and a service that flattens an UNGATED string the same way would join it
 *   without anything failing.
 *
 * Gating `statusLine` is therefore still unnecessary, and leaving it ungated is what keeps a
 * transport failure — the one case where nobody has anything better to say — from collapsing into
 * the fallback.
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
 * - A POSIX path is a token containing TWO separators between segments. The leading slash is
 *   optional, and that is the correction of a rule that used to require it. DMS's
 *   `NoResourceFoundException` handler builds its own text and prepends the slash by hand
 *   (`"No endpoint for " + method + " /" + path`), so the old rule fired there — but ModuleX's twin
 *   handler writes Spring's raw `ex.getMessage()` into `error`, and Spring 6.2 formats that as
 *   `"No static resource " + resourcePath + "."` where `resourcePath` is
 *   `PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE`. `PathPattern.extractPathWithinPattern` skips the
 *   leading separator before returning, so the value is `api/parlour/orders/999`, UNSLASHED. The
 *   rule caught the storage service and missed the backend every screen actually talks to.
 *
 *   Two separators, not one, is what still keeps prose out, and it is doing the whole job now that
 *   the anchor is gone. What used to be claimed here — that every curated string in either backend
 *   containing a slash contains exactly one — is false, and the narrower true statement is worth
 *   having in its place.
 *
 *   True of the THROW strings, which are the corpus this gate actually sees: ModuleX's "New
 *   appointment date/time cannot be null" and "Invalid appointment date/time format", "Record a
 *   wastage/transfer or change its status instead.", and the "(use reason=CORRECTION to move an
 *   ON_HOLD / QUARANTINED batch …)" message, whose lone slash has spaces around it and no segment
 *   after it — one slash each. DMS's `throw` strings contain none at all. The only ModuleX throws
 *   with two are `DmsClient`'s "DMS /folder/ensure failed …" and "DMS /folder/rename failed …",
 *   both named under the knowing cost below as demoted on purpose.
 *
 *   Not true of ModuleX's curated English generally. Five distinct `@Operation` descriptions in the
 *   main sources run two slashes together — "Customers are the people orders/appointments/bills
 *   were created for.", "…with search/sort/pagination" on the two billable-list endpoints,
 *   "(paginated, optional search/sort/status)" and "the chart's week/month/year toggle". Those are
 *   OpenAPI metadata: never thrown, never stamped into a wrapper, never seen by this module, so
 *   nothing is demoted by them today. What they establish is that `a/b/c` is a shape someone
 *   writing English about this domain reaches for unprompted, which is the part the old sentence
 *   denied.
 *
 *   The latent cost, measured through the real gate rather than reasoned about: "This batch is used
 *   by orders/appointments/bills and cannot be deleted.", "Search by name/username/email is
 *   unavailable right now." and "Expires on 31/12/2026 and cannot be extended." are all refused and
 *   would show the caller's fallback instead. None is a backend string today. That cost is accepted
 *   rather than designed around, because no narrowing is available that does not reopen the hole
 *   this rule was widened to close: a relative request path and a slash-run in prose are the SAME
 *   shape — `api/parlour/orders` and `orders/appointments/bills` differ in meaning and in nothing a
 *   regex can read. Every discriminator that suggests itself keys on something the motivating case
 *   lacks. Requiring a leading separator is exactly the anchor that missed Spring's unslashed "No
 *   static resource api/parlour/orders/999."; requiring a digit or a dot in one segment passes
 *   `api/parlour/orders`, which is the same handler's output for a path carrying no numeric id.
 *   A rule that is right about the enumerations and wrong about the paths is the worse of the two,
 *   because what it admits is a server's directory layout in a toast and what it avoids is one
 *   sentence being replaced by another sentence.
 *
 *   Spacing the slashes is the escape hatch that already exists and needs no rule: ModuleX's
 *   "filters by name / username / email / phone" is untouched, because the separator has to be
 *   followed immediately by a segment for the shape to fire.
 *
 *   The boundary before the token is kept for the same reason it was added — it is what stops the
 *   rule firing inside a longer word — and `I/O error on POST request for "…"` survives it twice
 *   over: one slash, and no second segment.
 * - A Windows path is a drive letter, a colon and a separator. It is checked even though the server
 *   runs Linux, because the same service is run on a developer's machine against a real client and
 *   the message travels unchanged; the colon-then-separator pair is what keeps a clock time out of
 *   it ("Expected YYYY-MM-DDTHH:mm:ss" has the colon and no separator after it).
 * - A URL is any `scheme://host`, not merely the `host:port` of the motivating string. An internal
 *   hostname with the port left off is the same disclosure with one fewer detail, and refusing the
 *   wider shape costs nothing measurable: no exception message string in either ModuleX or
 *   DMS-Backend contains `://` at all.
 *
 *   What this rule does NOT refuse is an address written with no scheme: a bare `dms-backend:8081`
 *   or `10.0.0.7:8081` passes it, and passes the other two shapes as well. That gap is left open
 *   knowingly. The motivating string is covered twice without closing it — Spring writes the
 *   address into `I/O error on POST request for "http://…"`, which carries the scheme AND matches
 *   `TRANSPORT_MESSAGE_MARKERS` on its own phrasing — and the rule that would close it cannot be
 *   drawn narrowly enough to pay for itself. `host:port` is `<token>:<digits>`, and to cover an IP
 *   the token has to admit digits, at which point the rule also reads `14:30` and `09:05`. A
 *   parlour and a pharmacy backend interpolate clock times into curated sentences — appointment
 *   times, expiry windows — and the Windows-path shape in the bullet above was already drawn around
 *   that same collision on purpose. Trading a live class of readable message against a shape neither
 *   backend is known to emit is the wrong side of this module's trade. A bare `host:port` turning
 *   up in a real message is the evidence that would reverse it.
 *
 * The knowing cost, checked rather than assumed by running the gate over both backends' curated
 * strings. Four are refused, all of them for naming a REQUEST path, which is indistinguishable
 * from a filesystem path and is refused with them:
 *
 * - DMS's `NoResourceFoundException` handler writes `"No endpoint for " + method + " /" + path`.
 *   The user gets that body's "Not found" instead, losing which endpoint 404'd — a fact for a
 *   developer reading a log, not for a person holding a phone.
 * - ModuleX's `NoResourceFoundException` handler writes Spring's own `"No static resource
 *   api/parlour/orders/999."`, and is the reason the leading slash stopped being required. Its
 *   body's `message` is the same "Not found", so the user loses nothing they were not already
 *   losing from DMS's spelling of the identical 404.
 * - `DmsClient` in ModuleX throws `"DMS /folder/ensure failed for '<name>' under parent <id>: "` and
 *   `"DMS /folder/rename failed for folder <id> -> '<name>': "`, each ending in the DMS wrapper's
 *   own `error` field. Losing these is a gain, not a cost: that tail is the very field
 *   `LocalStorageService` fills with absolute paths, so the string is a CARRIER for the leak rather
 *   than a victim of the rule. The endpoint name it also publishes is internal API surface.
 */
const LOCATOR_MARKERS: readonly RegExp[] = [
  /(?:^|[\s:="'([])[\w.-]*\/[\w.-]+\/[\w.-]/,
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
 * The chain itself, over a body that is already in hand.
 *
 * `thrownMessage` is the only thing the two entry points disagree about. `extractErrorInfo` has an
 * `err.message` to offer as the status line; `apiMessage` has none and passes `undefined`, because
 * a wrapper that arrived on an HTTP 200 was never carried by a rejection — nothing built an axios
 * sentence for it, so there is no status line to consult rather than one being withheld.
 *
 * Taking it as a parameter instead of reading it here is what lets both routes run this function
 * literally rather than each spelling the chain out for itself. Spelling it out twice is the defect
 * this split exists to prevent: the same wrapper reached the user through two code paths and only
 * one of them was gated.
 */
function infoFromBody(data: unknown, thrownMessage: unknown, fallback: string): ApiErrorInfo {
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
  const statusLine = wrapperSpoke ? undefined : text(thrownMessage);

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
 * Message plus code, for callers whose result contract carries both — `useModuleService` returns
 * `{ success: false, code, error }` and its screens branch on the code.
 */
export function extractErrorInfo(err: unknown, fallback: string): ApiErrorInfo {
  // Every hop is optional-chained off a cast rather than type-guarded, because `err` is genuinely
  // anything: a rejected non-Error, a string, `undefined` from a bare `throw`. Optional chaining
  // makes each of those miss instead of throw a second error out of the catch block.
  const source = err as { response?: { data?: unknown } | null; message?: unknown } | null;
  return infoFromBody(source?.response?.data, source?.message, fallback);
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

/**
 * A server-described failure, thrown without throwing the server's envelope away.
 *
 * The gate above reads `err.response.data`, so an error that keeps the body there flows through it
 * unchanged — that is the entire design, and it is why this fixes the leak at the cause rather than
 * adding a second net under `statusLine`. Nothing in `extractErrorInfo` knows this class exists.
 *
 * It is needed because the call sites turn a resolved-but-failed body back into a throw, and the
 * way they did it — `new Error(response.error || response.message || '<fallback>')` — kept the
 * sentence and dropped the envelope, which left the extractor nothing to inspect. Same shape, two
 * routes, two different answers for identical text.
 *
 * On how that body arrives: an earlier draft of this comment said ModuleX answers a refused write
 * with HTTP 200 and `success: false`. It does not. All 51 of its `.success(false)` builders sit
 * under a non-2xx `ResponseEntity`, so its refusals reject and land at `response.data` already.
 * These branches are defensive against a resolved body that reports failure — a shape auth-service
 * and DMS can produce, and one a future ModuleX endpoint could. That is a thinner justification
 * than the one it replaces, and it is the true one.
 *
 * `message` is deliberately still the raw field. In this codebase some thrown message text is
 * routing, not display copy: `LoginScreen` lower-cases `err.message` and branches on 'invalid
 * credentials' and 'not found with username' to choose which sentence to show, and
 * `isVerificationError` regex-matches the signup throw to decide whether to bounce the user back to
 * re-verify. Replacing the message with the fallback would have re-routed both silently. The body
 * is attached ALONGSIDE it, so the property those branches read is byte for byte what it was.
 *
 * That buys gating only where something actually consults the body. `completeSignup` does. The auth
 * SCREENS do not: `ForgotPasswordEmailScreen`, `ForgotPasswordOtpScreen` and `SignupScreen` each
 * render `err?.message` directly, so on those paths the attached body is carried and never read,
 * and auth-service's `"Internal server error: " + ex.getMessage()` still reaches the user whole.
 * That is unchanged from before this class existed rather than caused by it — but it is not closed,
 * and a comment claiming otherwise is how this module has repeatedly hidden its own leaks.
 */
export class ApiError extends Error {
  /**
   * Nested under `response` rather than held flat, because flat would mean teaching the extractor a
   * second shape — and a second shape is a second place for a rule to be forgotten, which is the
   * failure this class exists to end.
   */
  readonly response: { data: unknown };

  constructor(message: string, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.response = { data };
  }
}

/**
 * Build the throw a call site used to write by hand.
 *
 * The `error`-then-`message`-then-fallback order is the one every one of these sites already used,
 * and it is reproduced here with `||` rather than with `text()` so the message is character for
 * character what it was before the conversion. `text()` would trim, which is harmless at today's 14
 * call sites and still not worth spending: `.message` is the property this codebase has twice made
 * load-bearing (see `ApiError`), so a conversion that changes it by even a space is a conversion
 * that has to be re-argued rather than read.
 *
 * Taking the whole body rather than the two fields is what carries `code` through as well, which a
 * hand-written `new Error` had no way to keep: `extractErrorInfo` can now report the wrapper's code
 * at these sites instead of returning an untyped failure.
 */
export function apiError(body: unknown, fallback: string): ApiError {
  const wrapper: ErrorBody | undefined =
    typeof body === 'object' && body !== null ? (body as ErrorBody) : undefined;
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
  return new ApiError(asString(wrapper?.error) || asString(wrapper?.message) || fallback, body);
}

/**
 * The gated message for a refusal that never becomes a throw.
 *
 * `ApiError` and `apiError` cover the sites that turn a `success: false` wrapper back into an
 * exception. Most sites do not: they read the same HTTP-200 body in an `else` branch and lift its
 * text straight into `setError(...)` and the returned `{ error }`. Nothing is thrown, so no catch
 * block runs, `extractErrorMessage` is never reached, and those sites sat outside the gate
 * altogether — measured on one wrapper whose `error` was a foreign-key dump naming two tables and a
 * column, `createProduct` showed "Could not save this product." and `deleteProduct` beside it
 * showed the dump, verbatim, in a toast.
 *
 * Taking the parsed body rather than the two fields is the point. It keeps the code list, the
 * marker lists and the field order in this module instead of being copied into the 39 call sites
 * that need them — copies drifting apart is precisely how one half of a hook came to be gated and
 * the other half not.
 *
 * There is deliberately no `code` on the return. The sites that report one already have it: they
 * spread the server's own wrapper into their result, so the code travels untouched, and returning a
 * second copy from here would be one more thing that can disagree with the first. This function
 * decides the message and nothing else.
 *
 * `fallback` is the same literal the caller already had as the last arm of its `||` chain, passed
 * through unchanged. What changes is only which of the earlier arms is allowed to win.
 */
export function apiMessage(body: unknown, fallback: string): string {
  return infoFromBody(body, undefined, fallback).message;
}
