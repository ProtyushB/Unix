/**
 * Business API Interface
 * Mirrors BusinessController.java endpoints:
 *   POST   /business
 *   PUT    /business?updatePhone&updateEmail&updateIsActive
 *   GET    /business/{businessId}
 *   GET    /business/viewAll
 *   DELETE /business/{businessId}
 */

import { ApiResponse } from '../../auth/api/auth.api.interface';
import { BusinessDto, UpdateBusinessFlags } from '../../person/api/person.api.interface';

export abstract class BusinessApiInterface {
  abstract createBusiness(businessData: BusinessDto): Promise<ApiResponse<BusinessDto>>;
  abstract updateBusiness(businessData: BusinessDto, flags?: UpdateBusinessFlags): Promise<ApiResponse<BusinessDto>>;
  abstract getBusinessById(businessId: number): Promise<ApiResponse<BusinessDto>>;
  abstract getAllBusinesses(): Promise<ApiResponse<BusinessDto[]>>;
  abstract deleteBusiness(businessId: number): Promise<ApiResponse<BusinessDto>>;
}
