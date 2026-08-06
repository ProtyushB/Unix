/**
 * A bill's arithmetic.
 *
 * ⚠️ Every number here is for DISPLAY ONLY. The server recomputes all of it in
 * `calculateFinancials`, and `CreateBillRequest` has no field for `subtotal`, `discountAmount`,
 * `taxAmount` or `grandTotal` — there is literally nowhere to put them. What the client sends is
 * the four INPUTS: `tips`, `discount {type, value}`, `taxRate`, and a settlement amount.
 *
 * So why compute it at all? Because the user needs to see what they are about to charge before
 * they charge it. The formula is ported from Centrix's `calculateTotals` so the figure on the phone
 * and the figure on the web agree — and so that neither disagrees with the server, which applies
 * the same order of operations.
 */

export type DiscountType = 'FIXED' | 'PERCENTAGE';

export interface Discount {
  type: DiscountType;
  value: number;
}

export interface BillMoneyInput {
  /** Sum of the attached orders, appointments and bare lines. */
  subtotal: number;
  tips: number;
  discount: Discount;
  /** Percent, 0–100. */
  taxRate: number;
}

export interface BillMoney {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  tips: number;
  grandTotal: number;
}

function safe(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * The discount in rupees, clamped so it can never exceed the subtotal.
 *
 * Both branches clamp, and both need to: a FIXED discount larger than the bill would make the
 * total negative, and a PERCENTAGE above 100 would do the same by a different route. Centrix
 * clamps both; the server clamps both. A client that did not would show a negative total and then
 * "correct" itself on save, which reads as a bug in the total rather than in the input.
 */
export function discountAmount(subtotal: number, discount: Discount): number {
  const base = Math.max(0, safe(subtotal));
  const value = Math.max(0, safe(discount?.value));
  if (discount?.type === 'PERCENTAGE') {
    return Math.min((base * Math.min(value, 100)) / 100, base);
  }
  return Math.min(value, base);
}

/**
 * The whole calculation, in the server's order: discount off the subtotal, tax on what remains,
 * tips added last.
 *
 * Tips after tax is the load-bearing bit — taxing a tip would be wrong, and swapping the two lines
 * changes the total by tax × tips without changing anything visible about the inputs.
 */
export function computeBillMoney(input: BillMoneyInput): BillMoney {
  const subtotal = Math.max(0, safe(input.subtotal));
  const discount = discountAmount(subtotal, input.discount);
  const afterDiscount = subtotal - discount;
  const rate = Math.min(Math.max(0, safe(input.taxRate)), 100);
  const taxAmount = (afterDiscount * rate) / 100;
  const tips = Math.max(0, safe(input.tips));
  return {
    subtotal,
    discountAmount: discount,
    afterDiscount,
    taxAmount,
    tips,
    grandTotal: afterDiscount + taxAmount + tips,
  };
}

/** What is still owed. Never negative — an overpayment is a refund question, not a balance. */
export function balanceOf(grandTotal: number, paidAmount: number): number {
  return Math.max(0, safe(grandTotal) - safe(paidAmount));
}

/** "Discount (5%)" or plain "Discount", for the summary row's label. */
export function discountLabel(discount: Discount): string {
  if (discount?.type === 'PERCENTAGE' && safe(discount.value) > 0) {
    return `Discount (${safe(discount.value)}%)`;
  }
  return 'Discount';
}

/**
 * Read the stored discount off a fetched bill.
 *
 * The column is nullable jsonb, so an absent discount is null rather than a zero object, and the
 * stored `type` is upper-case where the web portal's form state is lower-case. Normalising here
 * means the rest of the screen never has to ask which convention it is holding.
 */
export function readDiscount(raw: unknown): Discount {
  const row = raw as { type?: unknown; value?: unknown } | null | undefined;
  if (!row) return { type: 'FIXED', value: 0 };
  const type = String(row.type ?? '').toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
  return { type, value: Math.max(0, safe(row.value)) };
}

/**
 * The discount as the PUT wants it, or undefined.
 *
 * `undefined` drops the key from the JSON entirely, which is how the client says "no discount" —
 * and the server reads a missing key as null, clearing whatever was stored. That is the intended
 * behaviour for a discount the user removed, and it is why this returns undefined rather than
 * `{type: 'FIXED', value: 0}`, which would store a meaningless zero discount.
 */
export function writeDiscount(
  discount: Discount,
): { type: DiscountType; value: number } | undefined {
  const value = safe(discount?.value);
  if (value <= 0) return undefined;
  return { type: discount.type, value };
}

/**
 * Which settlement amount the server will accept for a payment status.
 *
 * `applySettlementAmounts` runs on every write and overwrites what the client sent: on PAID it
 * forces `paidAmount = grandTotal`, on REFUNDED it forces `refundedAmount = grandTotal`, and on
 * UNPAID or FAILED it zeroes both. Only the two PARTIAL states take a number from the client — and
 * for those, sending nothing is a 400 rather than a default.
 */
export function settlementField(paymentStatus: string): 'paidAmount' | 'refundedAmount' | null {
  if (paymentStatus === 'PARTIALLY_PAID') return 'paidAmount';
  if (paymentStatus === 'PARTIAL_REFUNDED') return 'refundedAmount';
  return null;
}

/** Whether the Paid-amount input should be on screen at all. */
export function showsSettlementInput(paymentStatus: string): boolean {
  return settlementField(paymentStatus) !== null;
}
