/**
 * Person Module - Public API
 */

export { usePerson } from './hook/usePerson';
export { PERSON_API_CONFIG, PERSON_BASE_URL } from './config/api.config';
export { PersonService } from './service/person.service';
export { getPersonService } from './provider/person.provider';
export type { PersonDto, BusinessDto, UpdatePersonFlags, UpdateBusinessFlags } from './api/person.api.interface';
