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
