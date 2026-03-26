/**
 * API Configuration for Business Module
 */

import { PERSON_BASE_URL } from '../../person/config/api.config';

export const BUSINESS_API_CONFIG = {
  BASE_URL: PERSON_BASE_URL,
  ENDPOINTS: {
    BUSINESS: '/business',
    BUSINESS_VIEW_ALL: '/business/viewAll',
    BUSINESS_BY_ID: (id: number) => `/business/${id}`,
  },
  TIMEOUT: 30000,
};
