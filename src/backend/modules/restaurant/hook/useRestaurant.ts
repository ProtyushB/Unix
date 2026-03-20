import {createModuleHook} from '../../shared/hook/useModuleService';
import {getRestaurantService} from '../provider/restaurant.provider';

export const useRestaurant = createModuleHook(getRestaurantService, 'Restaurant');
