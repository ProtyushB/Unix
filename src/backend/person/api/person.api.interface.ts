/**
 * Person/Business API Interface
 * Defines all API methods for Person and Business operations.
 */

import { ApiResponse } from '../../auth/api/auth.api.interface';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonDto {
  id?: number;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  phoneNumber?: string;
  personFolderId?: number | null;
  types?: string[];
  business?: BusinessDto[];
  [key: string]: unknown;
}

export interface BusinessDto {
  id?: number;
  businessName: string;
  businessType: string;
  businessPhone?: string;
  businessEmail?: string;
  registrationNumber?: string | null;
  businessRoles?: string[];
  isActive?: boolean;
  businessOwnerPersonId?: number;
  folderId?: number | null;
  [key: string]: unknown;
}

export interface UpdatePersonFlags {
  updatePhone?: boolean;
  updateEmail?: boolean;
  updateTypes?: boolean;
}

export interface UpdateBusinessFlags {
  updatePhone?: boolean;
  updateEmail?: boolean;
  updateIsActive?: boolean;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export abstract class PersonApiInterface {
  // Person APIs
  abstract createPerson(personData: PersonDto, hasBusiness?: boolean): Promise<ApiResponse<PersonDto>>;
  abstract updatePerson(personData: PersonDto, flags?: UpdatePersonFlags): Promise<ApiResponse<PersonDto>>;
  abstract getPersonById(personId: number): Promise<ApiResponse<PersonDto>>;
  abstract getPersonByUsername(username: string): Promise<ApiResponse<PersonDto>>;
  abstract getAllPersons(): Promise<ApiResponse<PersonDto[]>>;
  abstract deletePerson(personId: number): Promise<ApiResponse<PersonDto>>;

  // Business APIs
  abstract createBusiness(businessData: BusinessDto): Promise<ApiResponse<BusinessDto>>;
  abstract updateBusiness(businessData: BusinessDto, flags?: UpdateBusinessFlags): Promise<ApiResponse<BusinessDto>>;
  abstract getBusinessById(businessId: number): Promise<ApiResponse<BusinessDto>>;
  abstract getAllBusinesses(): Promise<ApiResponse<BusinessDto[]>>;
  abstract deleteBusiness(businessId: number): Promise<ApiResponse<BusinessDto>>;
}
