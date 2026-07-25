/**
 * API Configuration for DMS Module
 */

import {
  DMS_API_URL,
  DMS_APP_ROOT_FOLDER_ID as ENV_DMS_APP_ROOT_FOLDER_ID,
  DMS_BUSINESS_APP_ROOT_FOLDER_ID as ENV_DMS_BUSINESS_APP_ROOT_FOLDER_ID,
} from '../../../config/env';

export const DMS_BASE_URL: string = DMS_API_URL;
export const DMS_APP_ROOT_FOLDER_ID: string = ENV_DMS_APP_ROOT_FOLDER_ID;
export const DMS_BUSINESS_APP_ROOT_FOLDER_ID: string =
  ENV_DMS_BUSINESS_APP_ROOT_FOLDER_ID;

export const DMS_API_CONFIG = {
  baseURL: DMS_BASE_URL,
  timeout: 30000,
};
