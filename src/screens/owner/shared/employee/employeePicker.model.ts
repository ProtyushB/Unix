import type { EmploymentDto } from '../../../../backend/person';

/**
 * The employee picker's arithmetic, kept RN-free so jest can cover it.
 *
 * Backs the expense form's "Reimburse to" field. Everything here is about turning an
 * `EmploymentDto` — which is a person's TIE to a business, not the person — into something a row
 * can render, and turning a stored id back into a name.
 */

/** One selectable staff member, flattened for rendering. */
export interface EmployeeOption {
  /**
   * ⚠️ The `employments(id)`, NOT a person id. This is the value an expense's `paidByEmployeeId`
   * stores, and the two are the same shape — passing a person id here fails a foreign key at best
   * and mis-attributes a reimbursement at worst.
   */
  id: number;
  name: string;
  email: string;
  /** "Stylist, Manager" — already joined, because a row renders one line. */
  roles: string;
}

/**
 * `EmploymentDto` → a row.
 *
 * Name resolution walks three fallbacks because the server populates them inconsistently: a
 * pre-computed `name`, then first + last, then the id. It never returns an empty string — a
 * nameless row is unpickable in practice, since the user has nothing to recognise.
 */
export function toEmployeeOption(dto: EmploymentDto): EmployeeOption {
  const id = Number(dto?.id);
  const joined = [dto?.firstName, dto?.lastName].filter(Boolean).join(' ').trim();
  const name = (dto?.name || '').trim() || joined || `Employee #${id}`;
  return {
    id,
    name,
    email: (dto?.email || '').trim(),
    roles: Array.isArray(dto?.roles) ? dto.roles.filter(Boolean).join(', ') : '',
  };
}

/**
 * Rows for the sheet, dropping anything with no usable id.
 *
 * A row whose id is missing or unparseable cannot be stored on an expense, so offering it would
 * produce a pick that silently does nothing — worse than not showing it.
 */
export function toEmployeeOptions(rows: EmploymentDto[] | null | undefined): EmployeeOption[] {
  return (rows ?? []).map(toEmployeeOption).filter((o) => Number.isFinite(o.id) && o.id > 0);
}

/**
 * Narrow by a typed query — name, email OR role, which is exactly what the search box promises.
 *
 * Blank returns the SAME array reference, so an untouched box allocates nothing and cannot become a
 * fresh dependency for an effect.
 */
export function filterEmployees(options: EmployeeOption[], query: string | null | undefined) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.roles.toLowerCase().includes(q),
  );
}

/** "priya@salon.com · Stylist" — the row's second line. Either half may be missing. */
export function employeeMetaLine(option: EmployeeOption): string {
  return [option.email, option.roles].filter(Boolean).join(' · ');
}

/**
 * A stored id → the name to show on the form.
 *
 * Falls back to `Employee #12` rather than a blank or a bare number when the id is not in the
 * fetched list. That happens for real: the list is ACTIVE staff only, so an expense reimbursing
 * someone who has since left resolves to nothing — and showing blank there reads as "no one was
 * chosen", which is a different and wrong statement about a settled reimbursement.
 */
export function employeeName(
  id: number | null | undefined,
  options: EmployeeOption[],
): string | null {
  if (id == null) return null;
  const hit = options.find((o) => o.id === Number(id));
  return hit ? hit.name : `Employee #${id}`;
}
