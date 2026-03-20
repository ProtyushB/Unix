import {createModuleHook} from '../../shared/hook/useModuleService';
import {getPharmacyService} from '../provider/pharmacy.provider';

export const usePharmacy = createModuleHook(getPharmacyService, 'Pharmacy');
