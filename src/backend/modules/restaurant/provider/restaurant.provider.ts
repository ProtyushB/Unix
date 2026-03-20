import {RestaurantService} from '../service/restaurant.service';
import {RestaurantApiImpl} from '../api/restaurant.api.impl';

let instance: RestaurantService | null = null;

export function getRestaurantService(): RestaurantService {
  if (!instance) {
    instance = new RestaurantService(new RestaurantApiImpl());
  }
  return instance;
}
