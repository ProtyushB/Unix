/**
 * API Configuration for DMS Module
 */

import Config from 'react-native-config';

export const DMS_BASE_URL: string = Config.DMS_API_URL || 'http://localhost:8087';
export const DMS_APP_ROOT_FOLDER_ID: string = Config.DMS_APP_ROOT_FOLDER_ID || '';
export const DMS_BUSINESS_APP_ROOT_FOLDER_ID: string = Config.DMS_BUSINESS_APP_ROOT_FOLDER_ID || '';

export const DMS_API_CONFIG = {
  baseURL: DMS_BASE_URL,
  timeout: 30000,
};
