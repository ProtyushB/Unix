import type { CustomerDto } from '../../../backend/person';
import { formatCurrency, initialsOf } from '../../../utils/formatters';

/**
 * Turning a `CustomerDto` into the strings a card and a profile render.
 *
 * RN-free so jest can cover it.
 *
 * ⚠️ A customer is DERIVED, not authored. The row exists because the person ordered, booked or was
 * billed — `business_customers` is written server-side by those events and by nothing else. There
 * is no create, edit or delete anywhere in this feature, and the rollups below are computed by the
 * server rather than by anything here.
 */

export interface CustomerRow {
  /** ⚠️ `personId`, NOT `id` — this projection is over Person, not a Person. */
  personId: number;
  name: string;
  initials: string;
  /** "+91 98765 43210 · priya@mail.com", or the honest "no email" when there is none. */
  contact: string;
  /** "₹42,300" — trimmed of a trailing `.00`. */
  totalSpentText: string;
  /** "18 activity" / "1 activity". */
  activityText: string;
  /** "Since Mar 2025", or `''` when the server sent no first-seen stamp. */
  sinceText: string;
  /** "Last active 04 Aug", or `''`. */
  lastActiveText: string;
  raw: CustomerDto;
}

/**
 * The display name.
 *
 * Falls back to the email, then the phone, then the id — never to a blank. A customer with no name
 * is ordinary (a walk-in recorded from a phone number), and a blank card is unrecognisable and
 * untappable in practice.
 */
export function customerName(record: CustomerDto): string {
  const joined = [record?.firstName, record?.lastName]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (joined) return joined;
  const email = String(record?.email ?? '').trim();
  if (email) return email;
  const phone = String(record?.phoneNumber ?? '').trim();
  if (phone) return phone;
  return `Customer #${record?.personId ?? ''}`.trim();
}

/**
 * "+91 98765 43210 · priya@mail.com".
 *
 * When one half is missing the other stands alone, EXCEPT that a missing email is stated rather
 * than dropped — the mockup says "no email" for a reason: a walk-in with only a phone number is a
 * different and useful fact, not an absence to hide.
 */
export function contactLine(record: CustomerDto): string {
  const phone = String(record?.phoneNumber ?? '').trim();
  const email = String(record?.email ?? '').trim();
  if (phone && email) return `${phone} · ${email}`;
  if (phone) return `${phone} · no email`;
  return email;
}

/**
 * "₹42,300" and "₹42,300.50".
 *
 * `formatCurrency` is the shared Intl-free helper but always writes two decimals; a spend total is
 * read at a glance, so a trailing `.00` is noise. Real paise survive. Same treatment the expense
 * cards apply.
 */
export function formatSpend(amount: number | null | undefined): string {
  return formatCurrency(Number(amount ?? 0)).replace(/\.00$/, '');
}

/**
 * "18 activity".
 *
 * ⚠️ The word is "activity", not "visits" or "orders", and that is deliberate: server-side this
 * counts FINALIZED BILLS only — not orders, not appointments. Calling it visits would overstate it
 * for a business that bills monthly, and understate it for one that does not bill at all.
 */
export function activityLine(count: number | null | undefined): string {
  const n = Number(count ?? 0);
  return `${Number.isFinite(n) ? n : 0} activity`;
}

/** "Mar 2025" — month and year, which is the resolution "customer since" is read at. */
export function formatMonthYear(instant: string | null | undefined): string {
  const raw = String(instant ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
}

/** "04 Aug" — day and month, no year, for the card's last-active line. */
export function formatDayMonth(instant: string | null | undefined): string {
  const raw = String(instant ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}`;
}

/** "12 Mar 2025" — the profile's fuller date. */
export function formatFullDate(instant: string | null | undefined): string {
  const raw = String(instant ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')} ${month} ${d.getFullYear()}`;
}

/** "04 Aug 2026, 6:20 PM" — the profile's last-active stamp. */
export function formatStamp(instant: string | null | undefined): string {
  const day = formatFullDate(instant);
  if (!day) return '';
  const d = new Date(Date.parse(String(instant)));
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${day}, ${hour12}:${minute} ${h < 12 ? 'AM' : 'PM'}`;
}

export function toCustomerRow(record: CustomerDto): CustomerRow {
  const name = customerName(record);
  return {
    personId: Number(record?.personId ?? 0),
    name,
    initials: initialsOf(name),
    contact: contactLine(record),
    totalSpentText: formatSpend(record?.totalSpent),
    activityText: activityLine(record?.activityCount),
    sinceText: formatMonthYear(record?.firstSeenAt)
      ? `Since ${formatMonthYear(record.firstSeenAt)}`
      : '',
    lastActiveText: formatDayMonth(record?.lastActivityAt)
      ? `Last active ${formatDayMonth(record.lastActivityAt)}`
      : '',
    raw: record,
  };
}

/** "Since Mar 2025 · Last active 04 Aug" — the card's footer, collapsing either missing half. */
export function cardFooterLine(row: Pick<CustomerRow, 'sinceText' | 'lastActiveText'>): string {
  return [row.sinceText, row.lastActiveText].filter(Boolean).join(' · ');
}
