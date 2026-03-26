/**
 * Person Service
 * Business logic layer for Person/Business operations.
 */

import { getPersonApi } from '../provider/person.provider';
import {
  PersonApiInterface,
  PersonDto,
  BusinessDto,
  UpdatePersonFlags,
} from '../api/person.api.interface';
import { AxiosError } from 'axios';

interface ServiceResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export class PersonService {
  private api: PersonApiInterface;

  constructor() {
    this.api = getPersonApi();
  }

  // ===== Person Operations =====

  async createPerson(personData: PersonDto & { businesses?: BusinessDto[] }): Promise<ServiceResult<PersonDto>> {
    try {
      const hasBusiness = personData.businesses && personData.businesses.length > 0;

      const apiPayload: PersonDto = {
        firstName: personData.firstName,
        lastName: personData.lastName,
        userName: personData.userName,
        email: personData.email,
        phoneNumber: personData.phoneNumber,
        personFolderId: personData.personFolderId ?? null,
      };

      if (hasBusiness && personData.businesses) {
        apiPayload.business = personData.businesses.map((biz) => ({
          businessName: biz.businessName,
          businessRoles: this._parseBusinessRoles(biz.businessRoles),
          businessType: biz.businessType,
          businessPhone: biz.businessPhone,
          businessEmail: biz.businessEmail,
          registration: {
            cin: biz.registration?.cin ?? null,
            gstin: biz.registration?.gstin ?? null,
            pan: biz.registration?.pan ?? null,
          },
          isActive: true,
          folderId: biz.folderId ?? null,
        }));
      }

      const response = await this.api.createPerson(apiPayload, !!hasBusiness);

      if (response.success) {
        return { success: true, data: response.data, error: null };
      } else {
        return { success: false, data: null, error: response.error || response.message };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to create person'),
      };
    }
  }

  async updatePerson(personData: PersonDto, flags?: UpdatePersonFlags): Promise<ServiceResult<PersonDto>> {
    try {
      const response = await this.api.updatePerson(personData, flags);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to update person'),
      };
    }
  }

  async getPersonById(personId: number): Promise<ServiceResult<PersonDto>> {
    try {
      const response = await this.api.getPersonById(personId);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to get person'),
      };
    }
  }

  async getPersonByUsername(username: string): Promise<ServiceResult<PersonDto>> {
    try {
      const response = await this.api.getPersonByUsername(username);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to get person by username'),
      };
    }
  }

  async getAllPersons(): Promise<ServiceResult<PersonDto[]>> {
    try {
      const response = await this.api.getAllPersons();
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to get persons'),
      };
    }
  }

  async deletePerson(personId: number): Promise<ServiceResult<PersonDto>> {
    try {
      const response = await this.api.deletePerson(personId);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: this.extractErrorMessage(error, 'Failed to delete person'),
      };
    }
  }

  // ===== Private Helpers =====

  private _parseBusinessRoles(businessRoles: string[] | string | undefined): string[] {
    if (Array.isArray(businessRoles)) return businessRoles;
    if (typeof businessRoles === 'string') {
      return businessRoles.split(',').map((role) => role.trim());
    }
    return [];
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    return axiosError.response?.data?.error || axiosError.response?.data?.message || (error as Error).message || fallback;
  }
}
