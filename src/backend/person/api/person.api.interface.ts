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

/**
 * One row of a business's customer list.
 *
 * ⚠️ The id key is `personId`, NOT `id` — this is a projection over Person, not a Person. Anything
 * that treats these rows interchangeably with `PersonDto` has to normalise first.
 */
/**
 * ONE employment — a person's tie to a business, not the person.
 *
 * ⚠️ `id` here is the `employments(id)` that an expense's `paidByEmployeeId` points at. The person
 * behind it has a DIFFERENT id, and sending that one instead produces a 409 CONSTRAINT_VIOLATION at
 * best and a silent mis-attribution at worst. The two are not interchangeable.
 *
 * Loose beyond the keys the picker reads — the server returns a good deal more.
 */
export interface EmploymentDto {
  /** ⚠️ `employments(id)`, NOT a person id. This is what an expense stores. */
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface CustomerDto {
  personId: number;
  firstName?: string;
  lastName?: string;
  userName?: string;
  email?: string;
  phoneNumber?: string;
  firstSeenAt?: string;
  lastActivityAt?: string;
  activityCount?: number;
  totalSpent?: number;
  [key: string]: unknown;
}

/** One candidate returned by /persons/lookup. */
export interface CustomerLookupMatch {
  person: PersonDto;
  matchedByEmail?: boolean;
  matchedByPhone?: boolean;
  /** Already a customer of the businessId that was passed in. Drives the eligibility badge. */
  existingCustomer?: boolean;
}

/** Body for POST /persons/customer — a walk-in with no login. */
export interface CreateCustomerPayload {
  /** Split on whitespace into first/last by the caller, not the server. */
  name: string;
  email: string;
  phone: string;
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

  // Customer APIs
  /**
   * One business's customers, paginated and searchable. This is the picker's primary list.
   *
   * Not to be confused with `getAllPersons()` above, which hits `/persons/viewAll` — unscoped,
   * unpaginated, every Person the caller can see. That is never the right call for a picker.
   */
  abstract getCustomersByBusiness(
    businessId: number,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<ApiResponse<CustomerDto[]>>;
  /**
   * Create a walk-in customer. Both email and phone are required server-side — the person service
   * throws without them. The DMS root and Customer folder are provisioned server-side; the client
   * creates no folders.
   */
  abstract createCustomer(payload: CreateCustomerPayload): Promise<ApiResponse<PersonDto>>;
  /**
   * A business's ACTIVE staff, paginated (1-based). Backs the expense form's "Reimburse to" picker.
   *
   * ⚠️ Returns EMPLOYMENTS, not persons — `EmploymentDto.id` is the `employments(id)` an expense's
   * `paidByEmployeeId` refers to. The person's own id is on the nested person, and is NOT the one
   * to send.
   */
  abstract getActiveEmployees(
    businessId: number,
    page?: number,
    limit?: number,
  ): Promise<ApiResponse<EmploymentDto[]>>;
}
