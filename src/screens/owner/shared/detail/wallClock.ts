/**
 * IST wall-clock arithmetic for date+time fields.
 *
 * Lifted out of `consumptionDetail.model.ts`, which owned it while consumption was the only screen
 * that asked for a time. Expenses ask too, and a second copy of a timezone rule is how two screens
 * come to disagree about what "now" is.
 *
 * The shape it serves: a date+time field is a `DateField` (which owns the `YYYY-MM-DD` contract and
 * the UTC off-by-one it exists to prevent) plus an `OptionSheet` of fixed slots. Deliberately NOT a
 * platform datetime picker — that hands back a `Date` in the DEVICE's zone, and converting that into
 * an IST wall clock is precisely the conversion these fields exist to avoid. `AppointmentDetail`
 * made the same call and documents it.
 *
 * ⚠️ THE WIRE FORMATS ARE NOT THE SAME ACROSS FEATURES, and picking the wrong one is a 500 rather
 * than a validation error:
 *
 *   • `consumedAt` (consumption) and `appointmentDateTime` are **zone-less** `LocalDateTime` —
 *     `2026-08-09T14:30:00`, no `Z`, no offset, seconds mandatory. An offset here THROWS.
 *     → `joinWallClock`
 *   • `expenseDate` (expense) is an **`Instant`** — it needs an offset or a `Z` or Jackson cannot
 *     bind it at all. A zone-less value here is an unparseable body, which this backend answers
 *     with a 500 and no field name.
 *     → `joinIstInstant`
 *
 * India has no daylight saving, so the +05:30 offset is fixed for all dates. That is what lets this
 * module do the conversion as arithmetic rather than through a timezone database.
 */

/** Minutes IST runs ahead of UTC. Fixed — India has never observed DST. */
export const IST_OFFSET_MINUTES = 330;

/** `+05:30` — appended to a wall clock to make it an unambiguous instant. */
export const IST_OFFSET_SUFFIX = '+05:30';

/** Quarter-hour slots across the full day — a business can record at any hour it opens. */
export const TIME_SLOTS: readonly string[] = Array.from({ length: 96 }, (_, i) => {
  const minutes = i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/**
 * "17:10" → "5:10 PM".
 *
 * Built by hand rather than by `toLocaleTimeString`, which renders the meridiem lowercase on Chrome
 * and uppercase elsewhere. `% 12` alone turns midnight into a nonsense "0", so both ends are
 * special-cased.
 */
export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [rawH, rawM] = String(hhmm).split(':');
  const h = Number(rawH);
  if (!Number.isFinite(h)) return '';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${(rawM ?? '00').padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * A stored ZONE-LESS wall clock split into the two controls that edit it.
 *
 * String surgery, never `new Date(...)`: the value carries no zone, so JS would parse it as
 * device-local — right by accident on an IST phone and wrong everywhere else, including the web
 * preview.
 */
export function splitWallClock(value: string | null | undefined): { date: string; time: string } {
  const raw = String(value ?? '').trim();
  if (!raw) return { date: '', time: '' };
  const [datePart, timePart = ''] = raw.split('T');
  return { date: datePart, time: timePart.slice(0, 5) };
}

/**
 * The two controls recombined into a ZONE-LESS `YYYY-MM-DDTHH:mm:ss` — no zone, no `Z`.
 *
 * Seconds are mandatory: the backend parses with `ISO_LOCAL_DATE_TIME`, which rejects a value
 * missing them, and anything carrying an offset throws.
 *
 * An empty DATE means the field is unset, so this answers `''` and the caller turns that into the
 * `null` that means "stamp it now". An empty TIME does NOT clear the field — the user picked a day
 * and that must not be silently discarded — so it falls back to midnight.
 */
export function joinWallClock(date: string, time: string): string {
  const d = String(date ?? '').trim();
  if (!d) return '';
  const t = String(time ?? '').trim() || '00:00';
  return `${d}T${t.length === 5 ? `${t}:00` : t}`;
}

/**
 * The two controls recombined into an INSTANT: `2026-08-09T14:30:00+05:30`.
 *
 * For a field the server binds as `Instant` rather than `LocalDateTime`. The offset is written
 * literally instead of converting to UTC, which is the point: no `Date` is constructed, so the
 * device's own zone never enters the calculation, and the string still names the wall clock the
 * user actually chose. Jackson resolves it to the correct instant on arrival.
 *
 * Empty date → `''`, same contract as `joinWallClock`.
 */
export function joinIstInstant(date: string, time: string): string {
  const local = joinWallClock(date, time);
  return local ? `${local}${IST_OFFSET_SUFFIX}` : '';
}

/**
 * An INSTANT off the wire → the IST date and time to seed the two controls with.
 *
 * The inverse of `joinIstInstant`. Here a `Date` IS constructed, and safely: the input carries a
 * zone (`Z` or an offset), so parsing is unambiguous on every device. The IST shift is then applied
 * as arithmetic and read back through the `getUTC*` accessors, which is engine- and
 * locale-independent in a way `toLocaleString` is not.
 *
 * An unparseable or absent value answers two empty strings rather than throwing — a detail screen
 * renders a record it was given, and one bad timestamp must not blank the screen.
 */
export function splitIstInstant(value: string | null | undefined): { date: string; time: string } {
  const raw = String(value ?? '').trim();
  if (!raw) return { date: '', time: '' };
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return { date: '', time: '' };
  const ist = new Date(ms + IST_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    time: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`,
  };
}

/**
 * The nearest slot at or BEFORE `hhmm` — "17:10" → "17:00".
 *
 * Floors rather than rounds so seeding a field from the current clock can never land on a time that
 * has not happened yet. Out-of-range input falls back to the first slot rather than to an empty
 * string, so a picker always has something selected.
 */
export function snapToSlot(hhmm: string | null | undefined): string {
  const [rawH, rawM] = String(hhmm ?? '').split(':');
  const h = Number(rawH);
  const m = Number(rawM);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23) return TIME_SLOTS[0];
  const floored = Math.floor(Math.min(Math.max(m, 0), 59) / 15) * 15;
  return `${String(h).padStart(2, '0')}:${String(floored).padStart(2, '0')}`;
}
