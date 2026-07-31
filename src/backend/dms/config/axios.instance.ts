/**
 * Axios Instance for DMS Module
 *
 * DMS uses JWT auth; the gate is shared — see `src/backend/shared/config/authInterceptors.ts`.
 * `validateStatus` accepts 302 for S3 pre-signed URL redirects, which is the one thing this
 * client needs that the others do not.
 */

import axios from 'axios';
import { DMS_API_CONFIG } from './api.config';
import { installAuthInterceptors } from '../../shared/config/authInterceptors';

const dmsApiClient = installAuthInterceptors(
  axios.create({
    baseURL: DMS_API_CONFIG.baseURL,
    timeout: DMS_API_CONFIG.timeout,
    validateStatus: (status: number) => (status >= 200 && status < 300) || status === 302,
  }),
);

export default dmsApiClient;
