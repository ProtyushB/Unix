/**
 * API Configuration for Person Module
 */

import Config from 'react-native-config';

export const PERSON_BASE_URL: string = Config.PERSON_API_URL || 'http://localhost:8086';

export const PERSON_API_CONFIG = {
  BASE_URL: PERSON_BASE_URL,
  ENDPOINTS: {
    PERSONS: '/persons',
    PERSONS_VIEW_ALL: '/persons/viewAll',
    PERSONS_BY_ID: (id: number) => `/persons/${id}`,
    PERSONS_BY_USERNAME: (username: string) => `/persons/username/${username}`,
    BUSINESS: '/business',
    BUSINESS_VIEW_ALL: '/business/viewAll',
    BUSINESS_BY_ID: (id: number) => `/business/${id}`,
  },
  TIMEOUT: 30000,
};
