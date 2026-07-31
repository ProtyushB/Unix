/**
 * Axios Instance for Business Module
 *
 * Auth/refresh behaviour lives in the shared gate — see
 * `src/backend/shared/config/authInterceptors.ts`.
 */

import axios from 'axios';
import { BUSINESS_API_CONFIG } from './api.config';
import { installAuthInterceptors } from '../../shared/config/authInterceptors';

const businessApiClient = installAuthInterceptors(
  axios.create({
    baseURL: BUSINESS_API_CONFIG.BASE_URL,
    timeout: BUSINESS_API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  }),
);

export default businessApiClient;
