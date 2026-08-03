/**
 * Person/Business API Implementation
 */

import personApiClient from '../config/axios.instance';
import { PERSON_API_CONFIG } from '../config/api.config';
import {
  PersonApiInterface,
  PersonDto,
  UpdatePersonFlags,
  CustomerLookupMatch,
  ClaimCustomerPayload,
} from './person.api.interface';
import { ApiResponse } from '../../auth/api/auth.api.interface';

export class PersonApiImpl extends PersonApiInterface {
  // ===== Person APIs =====

  async createPerson(personData: PersonDto, hasBusiness = false): Promise<ApiResponse<PersonDto>> {
    const url = hasBusiness
      ? `${PERSON_API_CONFIG.ENDPOINTS.PERSONS}?hasBusiness=true`
      : PERSON_API_CONFIG.ENDPOINTS.PERSONS;

    const response = await personApiClient.post(url, personData);
    return response.data;
  }

  /**
   * Looks up walk-in customers by email and/or phone. Used pre-auth during
   * signup to decide whether an in-store profile already exists for this
   * person.
   */
  async lookupCustomers(params: {
    email?: string;
    phone?: string;
    businessId?: number;
  }): Promise<ApiResponse<CustomerLookupMatch[]>> {
    const query = new URLSearchParams();
    if (params.email?.trim()) query.append('email', params.email.trim());
    if (params.phone?.trim()) query.append('phone', params.phone.trim());
    if (params.businessId != null) query.append('businessId', String(params.businessId));

    const response = await personApiClient.get(
      `${PERSON_API_CONFIG.ENDPOINTS.PERSONS_LOOKUP}?${query.toString()}`,
    );
    return response.data;
  }

  /**
   * Links an existing walk-in Person to the freshly created login, attaching
   * any businesses in the same call.
   *
   * The backend does the link, the username swap, the business attach and the
   * BUSINESS_OWNER grant in ONE transaction — all-or-nothing. Do not split this
   * into claim-then-attach; a failure between the two used to strand a
   * claimed-but-businessless owner.
   */
  async claimCustomer(payload: ClaimCustomerPayload): Promise<ApiResponse<PersonDto>> {
    // The backend's ClaimCustomerDto spells it `userName` (mirrors the Java field).
    const body: Record<string, unknown> = {
      userName: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneNumber: payload.phoneNumber,
    };
    if (payload.businesses && payload.businesses.length > 0) {
      body.business = payload.businesses;
    }

    const response = await personApiClient.post(PERSON_API_CONFIG.ENDPOINTS.CUSTOMERS_CLAIM, body);
    return response.data;
  }

  async updatePerson(
    personData: PersonDto,
    flags: UpdatePersonFlags = {},
  ): Promise<ApiResponse<PersonDto>> {
    const params = new URLSearchParams();
    if (flags.updatePhone) params.append('updatePhone', 'true');
    if (flags.updateEmail) params.append('updateEmail', 'true');
    if (flags.updateTypes) params.append('updateTypes', 'true');

    const queryString = params.toString();
    const url = queryString
      ? `${PERSON_API_CONFIG.ENDPOINTS.PERSONS}?${queryString}`
      : PERSON_API_CONFIG.ENDPOINTS.PERSONS;

    const response = await personApiClient.put(url, personData);
    return response.data;
  }

  async getPersonById(personId: number): Promise<ApiResponse<PersonDto>> {
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.PERSONS_BY_ID(personId));
    return response.data;
  }

  async getPersonByUsername(username: string): Promise<ApiResponse<PersonDto>> {
    const response = await personApiClient.get(
      PERSON_API_CONFIG.ENDPOINTS.PERSONS_BY_USERNAME(username),
    );
    return response.data;
  }

  async getAllPersons(): Promise<ApiResponse<PersonDto[]>> {
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.PERSONS_VIEW_ALL);
    return response.data;
  }

  async deletePerson(personId: number): Promise<ApiResponse<PersonDto>> {
    const response = await personApiClient.delete(
      PERSON_API_CONFIG.ENDPOINTS.PERSONS_BY_ID(personId),
    );
    return response.data;
  }
}
