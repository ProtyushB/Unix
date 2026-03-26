/**
 * Business API Implementation
 */

import businessApiClient from '../config/axios.instance';
import { BUSINESS_API_CONFIG } from '../config/api.config';
import { BusinessApiInterface } from './business.api.interface';
import { BusinessDto, UpdateBusinessFlags } from '../../person/api/person.api.interface';
import { ApiResponse } from '../../auth/api/auth.api.interface';

export class BusinessApiImpl extends BusinessApiInterface {
  async createBusiness(businessData: BusinessDto): Promise<ApiResponse<BusinessDto>> {
    const response = await businessApiClient.post(BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS, businessData);
    return response.data;
  }

  async updateBusiness(businessData: BusinessDto, flags: UpdateBusinessFlags = {}): Promise<ApiResponse<BusinessDto>> {
    const params = new URLSearchParams();
    if (flags.updatePhone) params.append('updatePhone', 'true');
    if (flags.updateEmail) params.append('updateEmail', 'true');
    if (flags.updateIsActive) params.append('updateIsActive', 'true');

    const queryString = params.toString();
    const url = queryString
      ? `${BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS}?${queryString}`
      : BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS;

    const response = await businessApiClient.put(url, businessData);
    return response.data;
  }

  async getBusinessById(businessId: number): Promise<ApiResponse<BusinessDto>> {
    const response = await businessApiClient.get(BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS_BY_ID(businessId));
    return response.data;
  }

  async getAllBusinesses(): Promise<ApiResponse<BusinessDto[]>> {
    const response = await businessApiClient.get(BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS_VIEW_ALL);
    return response.data;
  }

  async deleteBusiness(businessId: number): Promise<ApiResponse<BusinessDto>> {
    const response = await businessApiClient.delete(BUSINESS_API_CONFIG.ENDPOINTS.BUSINESS_BY_ID(businessId));
    return response.data;
  }
}
