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

export interface BusinessRegistrationDto {
  cin?: string | null;
  gstin?: string | null;
  pan?: string | null;
}

export interface BusinessDto {
  id?: number;
  businessName: string;
  businessType: string;
  businessPhone?: string;
  businessEmail?: string;
  registration?: BusinessRegistrationDto | null;
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

/** One candidate returned by /persons/lookup. */
export interface CustomerLookupMatch {
  person: PersonDto;
  matchedByEmail?: boolean;
  matchedByPhone?: boolean;
}

/** Body for /customers/claim — links an existing walk-in to a new login. */
export interface ClaimCustomerPayload {
  username: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  businesses?: unknown[];
}

// ─── Interface ────────────────────────────────────────────────────────────────

export abstract class PersonApiInterface {
  // Person APIs
  abstract createPerson(
    personData: PersonDto,
    hasBusiness?: boolean,
  ): Promise<ApiResponse<PersonDto>>;
  abstract updatePerson(
    personData: PersonDto,
    flags?: UpdatePersonFlags,
  ): Promise<ApiResponse<PersonDto>>;
  abstract getPersonById(personId: number): Promise<ApiResponse<PersonDto>>;
  abstract getPersonByUsername(username: string): Promise<ApiResponse<PersonDto>>;
  abstract getAllPersons(): Promise<ApiResponse<PersonDto[]>>;
  abstract deletePerson(personId: number): Promise<ApiResponse<PersonDto>>;
  abstract lookupCustomers(params: {
    email?: string;
    phone?: string;
    businessId?: number;
  }): Promise<ApiResponse<CustomerLookupMatch[]>>;
  abstract claimCustomer(payload: ClaimCustomerPayload): Promise<ApiResponse<PersonDto>>;
}
