import { useCallback, useEffect, useRef, useState } from 'react';
import { getPersonService } from '../../../../backend/person';
import {
  EMPTY_NEW_CUSTOMER,
  toCustomerMatches,
  toCustomerOption,
  toCustomerOptions,
  validateNewCustomer,
  viewAfterCancelCreate,
  viewAfterSearch,
  type CustomerMatch,
  type CustomerOption,
  type NewCustomerForm,
  type PickerView,
} from './customerPicker.model';

/** Matches Centrix's `CustomerSearchModal`, so the two clients page identically. */
const PAGE_SIZE = 20;

/**
 * Only the "your customers" list is debounced.
 *
 * The Centrix-wide lookup is an EXACT match on a whole email or phone number, so running it per
 * keystroke would fire a dozen guaranteed-empty queries on the way to one useful one. It gets a
 * Search button instead. Same split as the web portal.
 */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * State for the shared customer picker.
 *
 * Deliberately talks to `PersonService` directly rather than through the module hook: customers
 * are a Person concern, not a parlour/pharmacy one, and the module hook's own customer loader was
 * removed in the same change that added this (it called `/persons/viewAll` — unscoped and
 * unpaginated — and nothing used it).
 *
 * Every decision here is a call into `customerPicker.model`, which is RN-free and tested. If an
 * `if` appears that is not `await`/`setState` plumbing, it belongs there instead.
 */
export function useCustomerPicker(businessId: number | null, isOpen: boolean) {
  const [view, setView] = useState<PickerView>('list');

  // "Your customers" — paged, debounced, infinite-scrolled.
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CustomerOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Centrix-wide lookup — explicit, undebounced.
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);

  // Create.
  const [form, setForm] = useState<NewCustomerForm>(EMPTY_NEW_CUSTOMER);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Guards a resolved page against a newer one that already landed. The list is debounced, so two
  // requests can be in flight when someone types fast, and the slower one must not win.
  const requestSeq = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number, search: string, append: boolean) => {
      if (businessId == null) {
        setRows([]);
        return;
      }
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else setLoadingList(true);

      const result = await getPersonService().getCustomersByBusiness(
        businessId,
        nextPage,
        PAGE_SIZE,
        search,
      );
      if (seq !== requestSeq.current) return;

      if (result.success) {
        const mapped = toCustomerOptions(result.data);
        setRows((prev) => (append ? [...prev, ...mapped] : mapped));
        setPage(nextPage);
        setTotalPages(result.totalPages ?? 1);
      } else if (!append) {
        // A failed list is emptied rather than left stale — a stale list under a new query is a
        // wrong answer, not a partial one. The error is surfaced; unlike Centrix, which swallows it.
        setRows([]);
        setError(result.error ?? 'Could not load customers.');
      }

      setLoadingList(false);
      setLoadingMore(false);
    },
    [businessId],
  );

  // One effect for both the initial load and every re-search: opening the picker is just the
  // debounced empty query. Centrix does the same, and it keeps the two paths from drifting.
  useEffect(() => {
    if (!isOpen) return;
    const handle = setTimeout(() => {
      void loadPage(1, query, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [isOpen, query, loadPage]);

  // Everything resets on open. A picker that reopens on the previous search's results — or worse,
  // on a half-filled create form — is the kind of state leak nobody reports and everybody hits.
  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setQuery('');
    setEmail('');
    setPhone('');
    setMatches([]);
    setForm(EMPTY_NEW_CUSTOMER);
    setError(null);
  }, [isOpen]);

  const loadMore = useCallback(() => {
    if (loadingList || loadingMore || page >= totalPages) return;
    void loadPage(page + 1, query, true);
  }, [loadingList, loadingMore, page, totalPages, query, loadPage]);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    const result = await getPersonService().lookupCustomers({
      email,
      phone,
      businessId: businessId ?? undefined,
    });
    if (result.success) {
      const found = toCustomerMatches(result.data);
      setMatches(found);
      setView(viewAfterSearch(found.length));
    } else {
      // Land on `empty` rather than staying put: the search DID run and produced nothing usable, so
      // the create path is the useful next step. The message says why it is empty.
      setMatches([]);
      setError(result.error ?? 'Search failed. Please try again.');
      setView('empty');
    }
    setSearching(false);
  }, [email, phone, businessId]);

  const backToList = useCallback(() => {
    setError(null);
    setView('list');
  }, []);

  const startCreate = useCallback(() => {
    setError(null);
    // Carry the search terms across — the user has already typed them once, and they are exactly
    // the two fields the create form needs.
    setForm((prev) => ({ ...prev, email: prev.email || email, phone: prev.phone || phone }));
    setView('create');
  }, [email, phone]);

  const cancelCreate = useCallback(() => {
    setError(null);
    setView(viewAfterCancelCreate(matches.length));
  }, [matches.length]);

  const setField = useCallback((field: keyof NewCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Create the walk-in and hand it straight back, or null.
   *
   * Returns the created customer rather than firing a callback so the component decides what
   * "picked" means — the same single exit every other selection uses.
   */
  const create = useCallback(async (): Promise<CustomerOption | null> => {
    const invalid = validateNewCustomer(form);
    if (invalid) {
      setError(invalid);
      return null;
    }
    setCreating(true);
    setError(null);
    const result = await getPersonService().createCustomer(form);
    setCreating(false);

    if (!result.success) {
      setError(result.error ?? 'Could not create the customer.');
      return null;
    }
    // The server answers with a PersonDto, which keys its id as `id` — not `personId` like the
    // customers list. `toCustomerOption` reads either.
    const created = toCustomerOption(result.data as Record<string, unknown> | null);
    if (!created) {
      setError(
        'The customer was created but came back without an id. Try picking them from the list.',
      );
      return null;
    }
    return created;
  }, [form]);

  return {
    view,
    error,
    // list
    query,
    setQuery,
    rows,
    loadingList,
    loadingMore,
    hasMore: page < totalPages,
    loadMore,
    // lookup
    email,
    setEmail,
    phone,
    setPhone,
    matches,
    searching,
    search,
    backToList,
    // create
    form,
    setField,
    creating,
    startCreate,
    cancelCreate,
    create,
  };
}
