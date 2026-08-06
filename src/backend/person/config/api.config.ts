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
  },
  TIMEOUT: 30000,
};
