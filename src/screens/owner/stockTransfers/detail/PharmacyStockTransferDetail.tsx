import type { StockTransferDetailSlots } from './StockTransferDetailBase';
import { moduleLabel } from './stockTransferDetail.modules';

/** Pharmacy's slots. See `ParlourStockTransferDetail` for why these are functions, not components. */
export function pharmacyStockTransferSlots(): StockTransferDetailSlots {
  return { moduleLabel: moduleLabel('PHARMACY') };
}
