import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ShoppingBag, Package, Beaker, Sparkles, Scissors } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ListShell } from '../../components/list/ListShell';
import { ListCard } from '../../components/list/ListCard';
import { ListGridTile } from '../../components/list/ListGridTile';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface MockProduct {
  id:       number;
  name:     string;
  category: 'HAIRCARE' | 'SKINCARE' | 'MAKEUP' | 'TOOL';
  price:    number;
  stock:    number;
  icon:     LucideIcon;
}

const MOCK_PRODUCTS: MockProduct[] = [
  { id: 1,  name: 'Herbal Shampoo',    category: 'HAIRCARE', price: 250,  stock: 42, icon: Package },
  { id: 2,  name: 'Matte Lipstick',    category: 'MAKEUP',   price: 450,  stock: 3,  icon: Sparkles },
  { id: 3,  name: 'Vitamin C Serum',   category: 'SKINCARE', price: 1200, stock: 14, icon: Beaker },
  { id: 4,  name: 'Hair Scissors Pro', category: 'TOOL',     price: 800,  stock: 5,  icon: Scissors },
  { id: 5,  name: 'Argan Oil',         category: 'HAIRCARE', price: 680,  stock: 67, icon: Beaker },
  { id: 6,  name: 'Clay Face Mask',    category: 'SKINCARE', price: 320,  stock: 0,  icon: Beaker },
  { id: 7,  name: 'Kohl Eyeliner',     category: 'MAKEUP',   price: 180,  stock: 28, icon: Sparkles },
  { id: 8,  name: 'Conditioner',       category: 'HAIRCARE', price: 280,  stock: 19, icon: Package },
  { id: 9,  name: 'Styling Comb Set',  category: 'TOOL',     price: 140,  stock: 11, icon: Scissors },
  { id: 10, name: 'Rose Face Mist',    category: 'SKINCARE', price: 410,  stock: 7,  icon: Beaker },
];

const FILTERS = [
  { id: 'ALL',      label: 'All' },
  { id: 'HAIRCARE', label: 'Haircare' },
  { id: 'SKINCARE', label: 'Skincare' },
  { id: 'MAKEUP',   label: 'Makeup' },
  { id: 'TOOL',     label: 'Tools' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stockMeta(stock: number): { label: string; statusKey: string } {
  if (stock === 0)  return { label: 'Out of stock', statusKey: 'CANCELLED' };
  if (stock < 10)   return { label: `Low · ${stock}`, statusKey: 'PENDING' };
  return { label: `In stock · ${stock}`, statusKey: 'COMPLETED' };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ProductsScreen() {
  const { palette } = useTheme();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView]     = useState<'list' | 'grid'>('grid');

  const visible = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => {
      const matchCat   = filter === 'ALL' || p.category === filter;
      const q          = search.trim().toLowerCase();
      const matchQuery = !q || p.name.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [filter, search]);

  return (
    <ListShell
      title="Products"
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      enableSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search products..."
      view={view}
      onViewChange={setView}
      onAdd={() => { /* TODO: navigate to product create */ }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} color={palette.muted} />}
          title="No products"
          message="No products match your filters"
        />
      ) : view === 'grid' ? (
        <FlatList
          key="grid"
          data={visible}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const meta = stockMeta(item.stock);
            return (
              <ListGridTile
                title={item.name}
                price={formatCurrency(item.price)}
                meta={meta.label}
                statusKey={meta.statusKey}
                icon={item.icon}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="list"
          data={visible}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const meta = stockMeta(item.stock);
            return (
              <ListCard
                title={item.name}
                subtitle={item.category}
                meta={meta.label}
                amount={formatCurrency(item.price)}
                status={meta.statusKey === 'COMPLETED' ? 'IN STOCK' : meta.statusKey === 'PENDING' ? 'LOW' : 'OUT'}
                statusKey={meta.statusKey}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ListShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gridContent: {
    paddingHorizontal: 10,
    paddingTop:        8,
    paddingBottom:     100,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  listContent: {
    paddingTop:    8,
    paddingBottom: 100,
  },
});
