/**
 * Everything the customer picker decides, with no React and no React Native in sight.
 *
 * RN-free because `jest.config.js` matches `*.test.ts` only — anything that lives in a `.tsx` is
 * untestable in this repo by construction. The picker is shared by three screens and reaches
 * outside the business (a Centrix-wide lookup, and a create), so its rules are worth pinning.
 *
 * Ported from Centrix's `CustomerSearchModal.jsx`, which is the behaviour users already know.
 */

import { initialsOf } from '../../../../utils/formatters';

// Re-exported so the picker's components have one import surface, matching how the detail models
// re-export their list model's formatters.
export { initialsOf };

// ─── Types ───────────────────────────────────────────────────────────────────

/** One selectable customer, flattened. Exactly the four fields the three save payloads need. */
export interface CustomerOption {
  id: number;
  name: string;
  email: string;
  phone: string;
}

/**
 * A Centrix-wide match. Carries the two things a plain option does not: whether this person is
 * already a customer of THIS business, and which field matched.
 */
export interface CustomerMatch extends CustomerOption {
  alreadyCustomer: boolean;
  matchedByEmail: boolean;
  matchedByPhone: boolean;
}

/** The picker's screen. `empty` is a searched-and-found-nothing state, not a first-load one. */
export type PickerView = 'list' | 'results' | 'empty' | 'create';

export interface NewCustomerForm {
  name: string;
  email: string;
  phone: string;
}

export const EMPTY_NEW_CUSTOMER: NewCustomerForm = { name: '', email: '', phone: '' };

// ─── Row shapes coming in ────────────────────────────────────────────────────

/**
 * Loose on purpose. Two different server shapes arrive here: `CustomerDto` from
 * `/businesses/{id}/customers`, which keys the id as **`personId`**, and `PersonDto` from
 * `/persons/lookup` and `/persons/customer`, which keys it as `id`. Normalising that difference in
 * one place is most of this module's reason to exist.
 */
interface RawPerson {
  id?: unknown;
  personId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phoneNumber?: unknown;
  [k: string]: unknown;
}

interface RawMatch {
  person?: RawPerson;
  matchedByEmail?: unknown;
  matchedByPhone?: unknown;
  existingCustomer?: unknown;
  [k: string]: unknown;
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function toId(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** "Anjali Rao" from the two name halves, collapsing the blanks either can be. */
export function fullName(row: RawPerson): string {
  return [str(row.firstName).trim(), str(row.lastName).trim()].filter(Boolean).join(' ');
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

/**
 * One server row → one option, or null when it carries no usable id.
 *
 * `personId ?? id` and not the other way round: a `CustomerDto` has only `personId`, a `PersonDto`
 * has only `id`, and nothing sends both — but if something ever does, the customer-list projection
 * is the more specific answer.
 */
export function toCustomerOption(row: RawPerson | null | undefined): CustomerOption | null {
  if (!row) return null;
  const id = toId(row.personId) ?? toId(row.id);
  if (id === null) return null;
  return {
    id,
    // A person with no name at all still has to be pickable and still has to render, so fall back
    // to the contact detail the row does have rather than showing an empty row.
    name: fullName(row) || str(row.email) || str(row.phoneNumber) || `#${id}`,
    email: str(row.email),
    phone: str(row.phoneNumber),
  };
}

export function toCustomerOptions(rows: unknown): CustomerOption[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => toCustomerOption(r as RawPerson))
    .filter((o): o is CustomerOption => o !== null);
}

/** `/persons/lookup` rows → match rows. Deduped by id: the same person can match on both fields. */
export function toCustomerMatches(rows: unknown): CustomerMatch[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<number>();
  const out: CustomerMatch[] = [];
  for (const raw of rows as RawMatch[]) {
    const option = toCustomerOption(raw?.person);
    if (!option || seen.has(option.id)) continue;
    seen.add(option.id);
    out.push({
      ...option,
      alreadyCustomer: raw?.existingCustomer === true,
      matchedByEmail: raw?.matchedByEmail === true,
      matchedByPhone: raw?.matchedByPhone === true,
    });
  }
  return out;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** "+91 90000 12345 · anjali@mail.com", or whichever half exists. */
export function contactLine(option: Pick<CustomerOption, 'email' | 'phone'>): string {
  return [option.phone, option.email].filter(Boolean).join(' · ');
}

/**
 * Why this row came back. Shown under the eligibility badge so the user can tell two similar
 * people apart — the whole point of the results screen is that an exact phone match and an exact
 * email match are different kinds of evidence.
 */
export function matchLabel(
  match: Pick<CustomerMatch, 'matchedByEmail' | 'matchedByPhone'>,
): string {
  if (match.matchedByEmail && match.matchedByPhone) return 'matched: email + phone';
  if (match.matchedByEmail) return 'matched: email';
  if (match.matchedByPhone) return 'matched: phone';
  return '';
}

export function eligibilityLabel(match: Pick<CustomerMatch, 'alreadyCustomer'>): string {
  return match.alreadyCustomer ? 'Already your customer' : 'In Centrix · new to you';
}

/** Success tone for someone already on the books, info for a stranger. Never a warning: both pick. */
export function eligibilityTone(match: Pick<CustomerMatch, 'alreadyCustomer'>): 'success' | 'info' {
  return match.alreadyCustomer ? 'success' : 'info';
}

export function resultsBanner(count: number): string {
  if (count === 0) return 'No customer found in Centrix';
  return `${count} match${count === 1 ? '' : 'es'} in Centrix — pick the correct customer`;
}

// ─── Gates ───────────────────────────────────────────────────────────────────

/**
 * The Centrix lookup is an EXACT match on email or phone, so it needs at least one of them. It is
 * also the reason that search is a button rather than a debounce: an exact-match query is
 * meaningless on every keystroke of a half-typed address.
 */
export function canSearch(email: string, phone: string): boolean {
  return Boolean(email?.trim()) || Boolean(phone?.trim());
}

export function canCreate(form: NewCustomerForm): boolean {
  return Boolean(form.name?.trim() && form.email?.trim() && form.phone?.trim());
}

/**
 * All three fields required, matching the server: `PersonServiceImpl.createCustomer` throws without
 * an email or a phone, and a customer with no name is not something anyone can pick from a list.
 * One message rather than per-field errors, mirroring Centrix.
 */
export function validateNewCustomer(form: NewCustomerForm): string | null {
  if (!canCreate(form)) return 'Name, email and phone are all required.';
  return null;
}

/** Where a completed lookup lands. Zero hits is a real destination, not an error. */
export function viewAfterSearch(matchCount: number): PickerView {
  return matchCount > 0 ? 'results' : 'empty';
}

/**
 * Where "Back to search" goes from the create form.
 *
 * Back to the results the user came through, not to the list — they got here by searching and
 * rejecting what they found, so dropping them at the top would make them do it again.
 */
export function viewAfterCancelCreate(matchCount: number): PickerView {
  return viewAfterSearch(matchCount);
}
