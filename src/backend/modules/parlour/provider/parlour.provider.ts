import {ParlourService} from '../service/parlour.service';
import {ParlourApiImpl} from '../api/parlour.api.impl';

let instance: ParlourService | null = null;

export function getParlourService(): ParlourService {
  if (!instance) {
    instance = new ParlourService(new ParlourApiImpl());
  }
  return instance;
}
