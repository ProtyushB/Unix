/**
 * Axios Instance for the Parlour Module
 *
 * Auth/refresh behaviour lives in the shared gate — see
 * `src/backend/shared/config/authInterceptors.ts`. This file used to carry its own copy, which
 * refreshed against PARLOUR_BASE_URL instead of the auth service: it 404'd and the catch wiped
 * the session, so every 401 here was a logout rather than a refresh.
 */

import axios from 'axios';
import { PARLOUR_BASE_URL } from './api.config';
import { installAuthInterceptors } from '../../../shared/config/authInterceptors';

const parlourApiClient = installAuthInterceptors(
  axios.create({
    baseURL: PARLOUR_BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  }),
);

export default parlourApiClient;
