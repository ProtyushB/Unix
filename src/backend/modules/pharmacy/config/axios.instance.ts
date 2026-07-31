/**
 * Axios Instance for the Pharmacy Module
 *
 * Auth/refresh behaviour lives in the shared gate — see
 * `src/backend/shared/config/authInterceptors.ts`. This file used to carry its own copy, which
 * refreshed against PHARMACY_BASE_URL instead of the auth service: it 404'd and the catch wiped
 * the session, so every 401 here was a logout rather than a refresh.
 */

import axios from 'axios';
import {PHARMACY_BASE_URL} from './api.config';
import {installAuthInterceptors} from '../../../shared/config/authInterceptors';

const pharmacyApiClient = installAuthInterceptors(
  axios.create({
    baseURL: PHARMACY_BASE_URL,
    timeout: 30000,
    headers: {'Content-Type': 'application/json'},
  }),
);

export default pharmacyApiClient;
