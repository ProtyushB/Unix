/**
 * API Configuration for Person Module
 */

import { PERSON_API_URL } from '../../../config/env';

export const PERSON_BASE_URL: string = PERSON_API_URL;

export const PERSON_API_CONFIG = {
  BASE_URL: PERSON_BASE_URL,
  ENDPOINTS: {
    PERSONS: '/persons',
    PERSONS_VIEW_ALL: '/persons/viewAll',
    PERSONS_BY_ID: (id: number) => `/persons/${id}`,
    PERSONS_BY_USERNAME: (username: string) => `/persons/username/${username}`,
    PERSONS_LOOKUP: '/persons/lookup',
    /** POST — creates a walk-in customer with no login. Email and phone both required. */
    PERSONS_CUSTOMER: '/persons/customer',
    CUSTOMERS_CLAIM: '/customers/claim',
    /**
     * A business's own customers, paginated. Lives under /businesses, not /persons — and unlike
     * /persons/**, that prefix is NOT exempt from the payment-activation interceptor, so an
     * unverified business gets a 403 here.
     */
    BUSINESS_CUSTOMERS: (businessId: number) => `/businesses/${businessId}/customers`,
    /**
     * A business's ACTIVE staff (accepted + active), paginated. The canonical way to fetch current
     * staff — used by the expense form's "Reimburse to" picker.
     *
     * It lives in the PERSON module rather than an employment one of its own because employee is a
     * Person ROLE, not a separate entity — the same reasoning that puts `BUSINESS_CUSTOMERS` here
     * despite neither path starting with `/persons`. Same host, same axios instance.
     *
     * ⚠️ The ids this returns are `employments(id)`, NOT person ids. An expense's
     * `paidByEmployeeId` is an employment id, so the two must not be swapped.
     *
     * ⚠️ Do NOT reach for `/employment/viewAll` instead: it is unscoped and returns employments
     * across EVERY business. Centrix calls that one and filters client-side; this is the fixed
     * version, not a port of it.
     *
     * `/employment/**` IS exempt from the payment-activation interceptor, so unlike
     * `BUSINESS_CUSTOMERS` above it stays reachable on an unverified business.
     */
    BUSINESS_ACTIVE_EMPLOYEES: (businessId: number) => `/employment/business/${businessId}/active`,
  },
  TIMEOUT: 30000,
};
