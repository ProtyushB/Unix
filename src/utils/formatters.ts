// ─── Month Abbreviations ─────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ─── Format Date → "DD MMM YYYY" ────────────────────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Format DateTime → "DD MMM YYYY, HH:mm" ─────────────────────────────────

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Format Currency → "₹1,234.56" ──────────────────────────────────────────

export function formatCurrency(amount: number): string {
  // Indian numbering system: last group of 3, then groups of 2
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  let formatted: string;
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    // Last 3 digits
    const last3 = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    // Group the remaining digits in pairs from the right
    const pairs = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = `${pairs},${last3}`;
  }

  const sign = amount < 0 ? '-' : '';
  return `${sign}\u20B9${formatted}.${decPart}`;
}

// ─── Format Compact Currency → "₹18.2K" / "₹1.2L" / "₹2.4Cr" ───────────────
// Indian short-scale, used by the dashboard stat cards where the card is too
// narrow for the full formatCurrency output.

export function formatCompactCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  const trim = (n: number) => {
    // One decimal, but drop a trailing ".0" so "18.0K" reads "18K".
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };

  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

// ─── Format Long Date → "Friday, 13 June" ───────────────────────────────────

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function formatLongDate(date: Date = new Date()): string {
  if (isNaN(date.getTime())) return '';
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;
}

// ─── Format Time Parts → { time, meridiem, date } ───────────────────────────
// Feeds the stacked three-line time chip on dashboard order/appointment rows.

export interface TimeParts {
  time: string;
  meridiem: string;
  date: string;
}

export function formatTimeParts(iso: string | null | undefined): TimeParts | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return {
    time: `${hours12}:${pad(d.getMinutes())}`,
    meridiem: hours24 < 12 ? 'AM' : 'PM',
    date: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
  };
}

// ─── Format Sync Time → "12:04 PM" ──────────────────────────────────────────

export function formatSyncTime(date: Date): string {
  if (isNaN(date.getTime())) return '';
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad(date.getMinutes())} ${hours24 < 12 ? 'AM' : 'PM'}`;
}

// ─── Format Phone → "+91 XXXXX XXXXX" ───────────────────────────────────────

export function formatPhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');

  // If 10 digits, format as Indian mobile
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // If 12 digits starting with 91, format with country code
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // Fallback: return as-is
  return phone;
}
