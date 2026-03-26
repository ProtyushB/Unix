/**
 * Business Service
 * Business logic layer for standalone Business operations.
 */

import { getBusinessApi } from '../provider/business.provider';
import { BusinessApiInterface } from '../api/business.api.interface';
import { BusinessDto, UpdateBusinessFlags } from '../../person/api/person.api.interface';
import { AxiosError } from 'axios';

interface ServiceResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export class BusinessService {
  private api: BusinessApiInterface;

  constructor() {
    this.api = getBusinessApi();
  }

  async createBusiness(data: BusinessDto & { personId?: number }): Promise<ServiceResult<BusinessDto>> {
    try {
      const payload: BusinessDto = {
        businessName: data.businessName,
        businessType: data.businessType,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        registration: {
          cin: data.registration?.cin ?? null,
          gstin: data.registration?.gstin ?? null,
          pan: data.registration?.pan ?? null,
        },
        isActive: true,
        businessOwnerPersonId: data.personId,
        businessRoles: data.businessRoles ?? [],
        folderId: data.folderId ?? null,
      };

      const response = await this.api.createBusiness(payload);

      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return { success: false, data: null, error: this.extractErrorMessage(error, 'Failed to create business') };
    }
  }

  async updateBusiness(businessData: BusinessDto, flags?: UpdateBusinessFlags): Promise<ServiceResult<BusinessDto>> {
    try {
      const response = await this.api.updateBusiness(businessData, flags);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return { success: false, data: null, error: this.extractErrorMessage(error, 'Failed to update business') };
    }
  }

  async getBusinessById(businessId: number): Promise<ServiceResult<BusinessDto>> {
    try {
      const response = await this.api.getBusinessById(businessId);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return { success: false, data: null, error: this.extractErrorMessage(error, 'Failed to get business') };
    }
  }

  async getAllBusinesses(): Promise<ServiceResult<BusinessDto[]>> {
    try {
      const response = await this.api.getAllBusinesses();
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return { success: false, data: null, error: this.extractErrorMessage(error, 'Failed to get businesses') };
    }
  }

  async deleteBusiness(businessId: number): Promise<ServiceResult<BusinessDto>> {
    try {
      const response = await this.api.deleteBusiness(businessId);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return { success: false, data: null, error: this.extractErrorMessage(error, 'Failed to delete business') };
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    return axiosError.response?.data?.error || axiosError.response?.data?.message || (error as Error).message || fallback;
  }
}
