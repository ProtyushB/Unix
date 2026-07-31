/**
 * Axios Instance for Person Module
 *
 * Auth/refresh behaviour lives in the shared gate — see
 * `src/backend/shared/config/authInterceptors.ts`.
 */

import axios from 'axios';
import { PERSON_API_CONFIG } from './api.config';
import { installAuthInterceptors } from '../../shared/config/authInterceptors';

const personApiClient = installAuthInterceptors(
  axios.create({
    baseURL: PERSON_API_CONFIG.BASE_URL,
    timeout: PERSON_API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  }),
);

export default personApiClient;
