/**
 * Axios Instance for Auth Module
 *
 * Auth/refresh behaviour lives in the shared gate — see
 * `src/backend/shared/config/authInterceptors.ts`. Login/signup/refresh 401s are excluded there,
 * so a bad password still surfaces as a form error rather than a session wipe.
 */

import axios from 'axios';
import { AUTH_API_CONFIG } from './api.config';
import { installAuthInterceptors } from '../../shared/config/authInterceptors';

const authApiClient = installAuthInterceptors(
  axios.create({
    baseURL: AUTH_API_CONFIG.baseURL,
    timeout: AUTH_API_CONFIG.timeout,
    headers: AUTH_API_CONFIG.headers,
  }),
);

export default authApiClient;
