/**
 * Person/Business API Implementation
 */

import personApiClient from '../config/axios.instance';
import { PERSON_API_CONFIG } from '../config/api.config';
import {
  PersonApiInterface,
  PersonDto,
  BusinessDto,
  UpdatePersonFlags,
  UpdateBusinessFlags,
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

  async updatePerson(personData: PersonDto, flags: UpdatePersonFlags = {}): Promise<ApiResponse<PersonDto>> {
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
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.PERSONS_BY_USERNAME(username));
    return response.data;
  }

  async getAllPersons(): Promise<ApiResponse<PersonDto[]>> {
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.PERSONS_VIEW_ALL);
    return response.data;
  }

  async deletePerson(personId: number): Promise<ApiResponse<PersonDto>> {
    const response = await personApiClient.delete(PERSON_API_CONFIG.ENDPOINTS.PERSONS_BY_ID(personId));
    return response.data;
  }

  // ===== Business APIs =====

  async createBusiness(businessData: BusinessDto): Promise<ApiResponse<BusinessDto>> {
    const response = await personApiClient.post(PERSON_API_CONFIG.ENDPOINTS.BUSINESS, businessData);
    return response.data;
  }

  async updateBusiness(businessData: BusinessDto, flags: UpdateBusinessFlags = {}): Promise<ApiResponse<BusinessDto>> {
    const params = new URLSearchParams();
    if (flags.updatePhone) params.append('updatePhone', 'true');
    if (flags.updateEmail) params.append('updateEmail', 'true');
    if (flags.updateIsActive) params.append('updateIsActive', 'true');

    const queryString = params.toString();
    const url = queryString
      ? `${PERSON_API_CONFIG.ENDPOINTS.BUSINESS}?${queryString}`
      : PERSON_API_CONFIG.ENDPOINTS.BUSINESS;

    const response = await personApiClient.put(url, businessData);
    return response.data;
  }

  async getBusinessById(businessId: number): Promise<ApiResponse<BusinessDto>> {
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.BUSINESS_BY_ID(businessId));
    return response.data;
  }

  async getAllBusinesses(): Promise<ApiResponse<BusinessDto[]>> {
    const response = await personApiClient.get(PERSON_API_CONFIG.ENDPOINTS.BUSINESS_VIEW_ALL);
    return response.data;
  }

  async deleteBusiness(businessId: number): Promise<ApiResponse<BusinessDto>> {
    const response = await personApiClient.delete(PERSON_API_CONFIG.ENDPOINTS.BUSINESS_BY_ID(businessId));
    return response.data;
  }
}
