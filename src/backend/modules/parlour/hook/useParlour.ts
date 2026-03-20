import {createModuleHook} from '../../shared/hook/useModuleService';
import {getParlourService} from '../provider/parlour.provider';

export const useParlour = createModuleHook(getParlourService, 'Parlour');
