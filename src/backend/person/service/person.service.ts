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
  ClaimCustomerPayload,
  CreateCustomerPayload,
  CustomerDto,
  EmploymentDto,
  CustomerLookupMatch,
} from '../api/person.api.interface';
import { extractErrorMessage } from '../../shared/http/axiosError';

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

  async createPerson(
    personData: PersonDto & { businesses?: BusinessDto[] },
  ): Promise<ServiceResult<PersonDto>> {
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
        error: extractErrorMessage(error, 'Failed to create person'),
      };
    }
  }

  async updatePerson(
    personData: PersonDto,
    flags?: UpdatePersonFlags,
  ): Promise<ServiceResult<PersonDto>> {
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
        error: extractErrorMessage(error, 'Failed to update person'),
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
        error: extractErrorMessage(error, 'Failed to get person'),
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
        error: extractErrorMessage(error, 'Failed to get person by username'),
      };
    }
  }

  /**
   * Finds the walk-in Person behind an email address, or null.
   *
   * Returns null on any failure rather than throwing: this runs during the
   * post-OTP triage, and a lookup outage must degrade to "no profile found"
   * (an ordinary signup) rather than blocking the user from registering.
   */
  async findPersonByEmail(email: string): Promise<PersonDto | null> {
    try {
      const response = await this.api.lookupCustomers({ email });
      const candidates = response?.data || [];
      const match = candidates.find((c) => c.matchedByEmail) || candidates[0];
      return match?.person || null;
    } catch {
      return null;
    }
  }

  /**
   * Links an existing walk-in Person to the login just created, attaching any
   * businesses atomically. Used instead of createPerson on the claim path — a
   * walk-in already exists in ModuleX, so inserting again would 409 on the
   * duplicate email/phone.
   */
  async claimCustomer(payload: ClaimCustomerPayload): Promise<ServiceResult<PersonDto>> {
    try {
      const response = await this.api.claimCustomer(payload);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(error, 'Failed to claim your account'),
      };
    }
  }

  // ===== Customer Operations =====

  /**
   * One business's customers, for the shared customer picker.
   *
   * Unlike `findPersonByEmail` above, failures are NOT swallowed: the picker has a visible list to
   * populate and an empty one means "this business has no customers", which is a different and
   * much more misleading statement than "the request failed". `totalPages` rides through so the
   * caller can page.
   */
  async getCustomersByBusiness(
    businessId: number,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<ServiceResult<CustomerDto[]> & { totalPages?: number }> {
    if (!businessId) {
      return { success: false, data: null, error: 'Business ID is required' };
    }
    try {
      const response = await this.api.getCustomersByBusiness(businessId, page, limit, search);
      if (response.success) {
        return {
          success: true,
          data: response.data,
          error: null,
          totalPages: (response as { totalPages?: number }).totalPages,
        };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(error, 'Failed to load customers'),
      };
    }
  }

  /**
   * A business's ACTIVE staff, for the expense form's "Reimburse to" picker.
   *
   * ⚠️ The rows are EMPLOYMENTS. `EmploymentDto.id` is the `employments(id)` an expense's
   * `paidByEmployeeId` refers to — not the person's id. Callers must pass that through unchanged.
   */
  async getActiveEmployees(
    businessId: number,
    page = 1,
    limit = 50,
  ): Promise<ServiceResult<EmploymentDto[]> & { totalPages?: number }> {
    if (!businessId) {
      return { success: false, data: null, error: 'Business ID is required' };
    }
    try {
      const response = await this.api.getActiveEmployees(businessId, page, limit);
      if (response.success) {
        return {
          success: true,
          data: response.data,
          error: null,
          totalPages: (response as { totalPages?: number }).totalPages,
        };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(error, 'Failed to load employees'),
      };
    }
  }

  /** System-wide exact lookup by email and/or phone. At least one must be non-blank. */
  async lookupCustomers(params: {
    email?: string;
    phone?: string;
    businessId?: number;
  }): Promise<ServiceResult<CustomerLookupMatch[]>> {
    if (!params.email?.trim() && !params.phone?.trim()) {
      return { success: false, data: null, error: 'Enter an email or a phone number to search' };
    }
    try {
      const response = await this.api.lookupCustomers(params);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(error, 'Search failed. Please try again.'),
      };
    }
  }

  /** Create a walk-in. All three fields are required server-side, so they are checked here first. */
  async createCustomer(payload: CreateCustomerPayload): Promise<ServiceResult<PersonDto>> {
    if (!payload.name?.trim() || !payload.email?.trim() || !payload.phone?.trim()) {
      return { success: false, data: null, error: 'Name, email and phone are all required.' };
    }
    try {
      const response = await this.api.createCustomer(payload);
      if (response.success) {
        return { success: true, data: response.data, error: null };
      }
      return { success: false, data: null, error: response.error || response.message };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: extractErrorMessage(error, 'Could not create the customer.'),
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
        error: extractErrorMessage(error, 'Failed to get persons'),
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
        error: extractErrorMessage(error, 'Failed to delete person'),
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
}
