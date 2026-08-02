import {
  toProductRow,
  formatSize,
  formatPrice,
  stockStateFor,
  stockDetail,
  productsHeaderLine,
  productsResultLine,
  productTintIndex,
  STOCK_BADGE_LABEL,
  STOCK_BADGE_LABEL_SHORT,
  type ProductRow,
} from './product.model';

const THRESHOLD = 10;

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: 1,
  name: 'Argan Repair Shampoo',
  brand: "L'Oréal Pro",
  price: 420,
  size: '250 ml',
  trackInventory: true,
  availableQuantity: 48,
  availability: true,
  ...over,
});

describe('toProductRow', () => {
  it('maps a full product', () => {
    const r = toProductRow({
      id: 7,
      name: 'Hydra Gloss Hair Serum',
      brand: 'Wella Pro',
      price: 780,
      volume: 100,
      volumeUnit: 'ml',
      trackInventory: true,
      availableQuantity: 5,
      availability: true,
    });

    expect(r.id).toBe(7);
    expect(r.name).toBe('Hydra Gloss Hair Serum');
    expect(r.brand).toBe('Wella Pro');
    expect(r.price).toBe(780);
    expect(r.size).toBe('100 ml');
    expect(r.availableQuantity).toBe(5);
  });

  // Null means "no number to show"; zero means "counted, and empty". Collapsing the two is exactly
  // how an untracked product ends up rendering "Out of stock".
  it('preserves a null quantity rather than coercing it to zero', () => {
    expect(toProductRow({availableQuantity: null}).availableQuantity).toBeNull();
    expect(toProductRow({}).availableQuantity).toBeNull();
    expect(toProductRow({availableQuantity: 0}).availableQuantity).toBe(0);
  });

  it('coerces string amounts', () => {
    // BigDecimal can serialise as a string depending on the mapper.
    expect(toProductRow({price: '599.99'}).price).toBeCloseTo(599.99);
  });

  it('names an untitled product rather than rendering a blank row', () => {
    expect(toProductRow({name: '   '}).name).toBe('Untitled product');
    expect(toProductRow({}).name).toBe('Untitled product');
  });

  it('leaves a missing brand empty instead of inventing a placeholder', () => {
    expect(toProductRow({brand: '  '}).brand).toBe('');
  });

  it('treats a missing trackInventory as untracked', () => {
    expect(toProductRow({}).trackInventory).toBe(false);
  });
});

describe('formatSize', () => {
  it('joins volume and unit', () => {
    expect(formatSize(250, 'ml')).toBe('250 ml');
    expect(formatSize(50, 'g')).toBe('50 g');
  });

  // Both halves are independently nullable on the entity.
  it('degrades gracefully when either half is missing', () => {
    expect(formatSize(250, null)).toBe('250');
    expect(formatSize(null, 'ml')).toBe('ml');
    expect(formatSize(null, null)).toBe('');
    expect(formatSize(0, 'ml')).toBe('ml');
  });
});

describe('stockStateFor', () => {
  it('reads a healthy quantity as tracked', () => {
    expect(stockStateFor(row({availableQuantity: 48}), THRESHOLD)).toBe('TRACKED');
  });

  // The boundary must agree with the server's, which counts <= threshold as low.
  it('counts exactly the threshold as low, and one above as healthy', () => {
    expect(stockStateFor(row({availableQuantity: 10}), THRESHOLD)).toBe('LOW');
    expect(stockStateFor(row({availableQuantity: 11}), THRESHOLD)).toBe('TRACKED');
  });

  it('reads zero as out, never as low', () => {
    expect(stockStateFor(row({availableQuantity: 0}), THRESHOLD)).toBe('OUT');
  });

  // A null quantity arrives two ways: the product opted out of tracking, or the business has the
  // Inventory tab off and the server nulls the quantity for everything.
  it('reads a null quantity as untracked whatever the flag says', () => {
    expect(stockStateFor(row({trackInventory: false, availableQuantity: null}), THRESHOLD)).toBe(
      'UNTRACKED',
    );
    expect(stockStateFor(row({trackInventory: true, availableQuantity: null}), THRESHOLD)).toBe(
      'UNTRACKED',
    );
  });

  it('reads an untracked product as untracked even when a quantity came through', () => {
    expect(stockStateFor(row({trackInventory: false, availableQuantity: 7}), THRESHOLD)).toBe(
      'UNTRACKED',
    );
  });

  // The threshold is supplied by the server so badges and the header count agree; a screen that
  // hardcoded its own would drift the moment the server's changed.
  it('honours a different threshold', () => {
    expect(stockStateFor(row({availableQuantity: 20}), 25)).toBe('LOW');
    expect(stockStateFor(row({availableQuantity: 20}), 10)).toBe('TRACKED');
  });
});

describe('stock copy', () => {
  it('labels each state for the list and the narrower grid card', () => {
    expect(STOCK_BADGE_LABEL.TRACKED).toBe('Tracked');
    expect(STOCK_BADGE_LABEL.LOW).toBe('Low stock');
    expect(STOCK_BADGE_LABEL.OUT).toBe('Out of stock');
    expect(STOCK_BADGE_LABEL_SHORT.TRACKED).toBe('In stock');
    expect(STOCK_BADGE_LABEL_SHORT.LOW).toBe('Low');
    expect(STOCK_BADGE_LABEL_SHORT.OUT).toBe('Out');
  });

  it('tells you the count, then how few, then what to do', () => {
    expect(stockDetail(row({availableQuantity: 48}), THRESHOLD)).toBe('48 in stock');
    expect(stockDetail(row({availableQuantity: 5}), THRESHOLD)).toBe('5 left');
    expect(stockDetail(row({availableQuantity: 0}), THRESHOLD)).toBe('Restock now');
  });

  it('says nothing for an untracked product — the badge already said "Available"', () => {
    expect(stockDetail(row({trackInventory: false, availableQuantity: null}), THRESHOLD)).toBe('');
  });
});

describe('formatting', () => {
  it('groups prices the Indian way', () => {
    expect(formatPrice(420)).toBe('₹420');
    expect(formatPrice(1234567)).toBe('₹12,34,567');
  });

  it('drops the low-stock clause when nothing is running down', () => {
    expect(productsHeaderLine(142, 6)).toBe('142 items · 6 low on stock');
    expect(productsHeaderLine(142, 0)).toBe('142 items');
    expect(productsHeaderLine(1, 0)).toBe('1 item');
  });

  it('pluralises the search result line', () => {
    expect(productsResultLine(3, 'shampoo')).toBe("3 results for 'shampoo'");
    expect(productsResultLine(1, 'aloe')).toBe("1 result for 'aloe'");
    expect(productsResultLine(0, 'Sunscreen')).toBe("0 results for 'Sunscreen'");
  });
});

describe('productTintIndex', () => {
  // The thumbnail colour has to survive a re-render and a refetch, or the list shimmers.
  it('is stable for the same name', () => {
    expect(productTintIndex('Argan Repair Shampoo', 8)).toBe(
      productTintIndex('Argan Repair Shampoo', 8),
    );
  });

  it('stays inside the pool', () => {
    for (const name of ['a', 'Aloe Soothing Gel', 'Vitamin C Brightening Cream', '']) {
      const i = productTintIndex(name, 8);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });

  it('does not divide by zero on an empty pool', () => {
    expect(productTintIndex('anything', 0)).toBe(0);
  });
});
