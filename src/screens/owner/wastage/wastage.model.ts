import type { InventoryType } from '../../../backend/modules/shared/inventory.types';
import type { WastageDto, WastageReason } from '../../../backend/modules/shared/wastage.types';
import { formatStamp } from '../inventory/batch.model';
import { effMult, isMixedUnitLines, recordQtyLabel } from '../inventory/batchUnits';

/**
 * A wastage DTO reduced to what one list row draws.
 *
 * RN-free so the mapping is testable. `WastageDto` itself lives in
 * `backend/modules/shared/wastage.types.ts` — this file is only the row, the same split
 * `batch.model.ts` uses.
 */

export interface WastageRow {
  id: number | null;
  name: string;
  /** "1 bottle · 100 ml" — the written-off quantity in unit names, mixed or scalar. */
  qtyText: string;
  /** Raw enum, not a label: the card tints from it, and the label is the view layer's job. */
  reason: WastageReason | null;
  /**
   * Which pool this came out of.
   *
   * Carried on the row because wastage is the ONLY one of the three features that spans both pools
   * — a consumption is always RAW and a transfer has two ends — so "which stock did this destroy?"
   * is a question only this row can answer, and the answer is not derivable from anything else on
   * it.
   */
  inventoryType: InventoryType | null;
  /** "22 Jul 2026, 10:15 AM". Empty when the record carries no timestamp. */
  whenText: string;
  /**
   * The note, trimmed to one line's worth. Empty when there is none.
   *
   * Truncated HERE rather than by `numberOfLines` on the card, because the card joins it to the
   * timestamp with a `·` — a note left full length would push the timestamp out of the row it
   * shares, and the timestamp is the half that is always worth reading.
   */
  notesSnippet: string;
  /**
   * How many batches the write-off came out of. Null when the row does not carry a ledger.
   *
   * Null ≠ 0. A list row has no `deductions` at all (the server only enriches the detail read), and
   * rendering that as "0 batches" would claim the write-off took stock from nothing.
   */
  batchCount: number | null;
}

/**
 * The product's name.
 *
 * `itemName` is denormalised onto the record precisely because a wastage outlives the product it
 * was recorded against — which is exactly when a name matters most. Falls back to the id so a row
 * is never nameless.
 */
export function wastageName(record: WastageDto): string {
  return (
    record?.itemName?.trim() ||
    (record?.itemId != null ? `Product #${record.itemId}` : 'Unknown product')
  );
}

/**
 * The base unit a record is measured in, worked out from the RECORD rather than from the catalog.
 *
 * Neither screen that needs this has the product's ladder to hand: the list never fetches the
 * catalog at all, and the detail screen only fetches it in add mode (`shouldLoadCatalog`). Without
 * this, every row would render "600 unit" where the number is plainly 600 ml.
 *
 * Two ways to recover it, in order:
 *
 *   • mixed — the LOWEST rung is the base one by definition, so its unit name is the base name.
 *   • scalar with `unitMultiplier === 1` — the level IS the base rung, so `unitName` is it. A
 *     multiplier above 1 means the record was entered in bottles or packs and the base unit's name
 *     genuinely is not on the record; the fallback is the honest answer there, because guessing
 *     "bottle" would render 1,000 base units as "1000 bottle".
 */
export function recordBaseUnit(record: WastageDto | null | undefined, fallback = 'unit'): string {
  const lines = record?.unitLines;
  if (isMixedUnitLines(lines)) {
    const lowest = [...(lines ?? [])].sort(
      (a, b) => effMult(a?.perStock) - effMult(b?.perStock),
    )[0];
    if (lowest?.unit) return lowest.unit;
  }
  if (effMult(record?.unitMultiplier ?? 1) === 1 && record?.unitName) return record.unitName;
  return fallback;
}

/** How much of a note a card shows before it starts eating the timestamp beside it. */
const NOTE_SNIPPET_MAX = 48;

/**
 * A note reduced to a card-sized fragment.
 *
 * Newlines collapse to spaces first — a multi-line note pasted into the field would otherwise be
 * cut at its first line break and look like the user wrote three words. The ellipsis is a single
 * character rather than three dots so it cannot be mistaken for part of the note.
 *
 * Whitespace-only is not a note: it returns empty, and the card then draws no separator.
 */
export function notesSnippet(notes: unknown, max = NOTE_SNIPPET_MAX): string {
  const text = typeof notes === 'string' ? notes.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * `baseUnit` is the FALLBACK, not the answer.
 *
 * The list has no catalog to read a ladder off, so the unit name is recovered from the record
 * itself and this argument only fills the gap `recordBaseUnit` cannot — a record entered in a
 * higher rung, which carries no name for what that rung is made of.
 */
export function toWastageRow(record: WastageDto, baseUnit = 'unit'): WastageRow {
  const unit = recordBaseUnit(record, baseUnit);
  return {
    id: record?.id ?? null,
    name: wastageName(record),
    qtyText: recordQtyLabel(
      {
        quantity: record?.quantity,
        unitName: record?.unitName,
        unitLines: record?.unitLines,
      },
      unit,
    ),
    reason: record?.reason ?? null,
    // Never defaulted to a pool. Guessing PRODUCT for a record that came out of RAW would put the
    // loss against the wrong stock in every read of the row.
    inventoryType: record?.inventoryType ?? null,
    whenText: formatStamp(record?.reportedAt),
    notesSnippet: notesSnippet(record?.notes),
    // Explicitly `null` when the key is absent, so "not enriched" and "took from nothing" stay
    // different facts.
    batchCount: Array.isArray(record?.deductions) ? record.deductions.length : null,
  };
}

/**
 * The subtitle under the screen title.
 *
 * ⚠️ It does NOT claim a record count, and that is not an oversight. `/byBusiness` returns
 * `totalPages` and nothing else — `totalElements` is never set on these endpoints — so there is no
 * row count to show, and no total value either: the endpoint reports no money figure.
 *
 * It DOES report the sort direction, and it has to: this used to say "newest first" unconditionally
 * while the sheet could flip the list to ascending, so the one figure the subtitle was allowed to
 * state was the one it got wrong.
 */
export function listSubtitle(filtered: boolean, sortDir: 'asc' | 'desc' = 'desc'): string {
  const order = sortDir === 'asc' ? 'oldest first' : 'newest first';
  return `${filtered ? 'Filtered' : 'Stock written off'} · ${order}`;
}
