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
    CUSTOMERS_CLAIM: '/customers/claim',
  },
  TIMEOUT: 30000,
};
