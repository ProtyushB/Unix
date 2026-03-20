import {PharmacyService} from '../service/pharmacy.service';
import {PharmacyApiImpl} from '../api/pharmacy.api.impl';

let instance: PharmacyService | null = null;

export function getPharmacyService(): PharmacyService {
  if (!instance) {
    instance = new PharmacyService(new PharmacyApiImpl());
  }
  return instance;
}
