import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import type { AppTheme } from '../../../../theme/theme.types';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CustomerPickerSheet } from '../../shared/customer/CustomerPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import { OrderDetailBase, type LineDisplay } from './OrderDetailBase';
import { ProductPickerSheet, type PickableProduct } from './parts/ProductPickerSheet';
import { useOrderDetailForm } from './useOrderDetailForm';
import { configFor, type OrderModuleKey } from './orderDetail.modules';
import {
  enrichedDisplay,
  statusLabel,
  STATUS_ORDER,
  type OrderDetailItem,
} from './orderDetail.model';
import { canEdit, deriveDetailView, lockedReason, type DetailMode } from './orderDetail.view';
import { saleUnitsOf } from './orderLineUnits';

/**
 * Which sheet is up.
 *
 * One piece of state rather than three booleans, because on react-native-web a Modal's portal
 * stays mounted after `visible` flips false and eats taps — so two open at once is a real bug, and
 * a union makes it unrepresentable rather than merely discouraged.
 */
type OpenSheet = 'none' | 'customer' | 'status' | 'products';

interface OrderDetailScreenProps {
  route?: { params?: { orderId?: number; mode?: DetailMode } };
  /** Optional, so the web preview can mount the screen with no navigator around it. */
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}

export function OrderDetailScreen({ route, navigation }: OrderDetailScreenProps = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { selectedModule } = useAppContext();

  // Both called unconditionally. A hook behind a conditional reorders the hook list and crashes
  // React — the products screen carries the same note for the same reason.
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  const moduleKey: OrderModuleKey =
    selectedModule?.toUpperCase() === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const config = configFor(moduleKey);

  /**
   * ⚠️ Pull the individual callbacks out, and never depend on `activeModule` itself.
   *
   * `createModuleHook` returns a fresh object literal on every render, so an effect or a
   * `useCallback` that lists `activeModule` in its deps re-runs on every render — and a fetch
   * effect that re-runs on every render sets state, which renders, which fetches again. That is an
   * unbounded request loop, and it is silent: the screen just sits on its spinner while hammering
   * the server. Observed here at 56 requests before it was caught. The callbacks below are each
   * `useCallback`-stable, so depending on them is safe.
   */
  const { loadOrder, loadProductOptions, createOrder, updateOrder, deleteOrder } = activeModule;

  const moduleApi = useMemo(
    () => ({ createOrder, updateOrder, deleteOrder }),
    [createOrder, updateOrder, deleteOrder],
  );

  const orderId = route?.params?.orderId;
  const [mode, setMode] = useState<DetailMode>(route?.params?.mode ?? 'view');
  const [item, setItem] = useState<OrderDetailItem | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [catalog, setCatalog] = useState<PickableProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchOrder = useCallback(async () => {
    if (orderId == null) {
      // Not a no-op: leaving `loading` true here would strand view/edit mode on a spinner forever
      // when the route arrives without an id, which reads exactly like a hung request.
      setLoadError('No order was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await loadOrder(orderId);
    if (result.success) setItem(result.data as OrderDetailItem);
    else setLoadError(result.error ?? 'Could not load this order.');
    setLoading(false);
  }, [orderId, loadOrder]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchOrder();
  }, [mode, fetchOrder]);

  /**
   * The catalog, for the picker and for each line's sale-unit ladder.
   *
   * Fetched only once the screen is editable — a read-only order renders entirely from the line
   * snapshots, so pulling the whole catalog to look at one would be a page of work for nothing.
   */
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    const result = await loadProductOptions(500);
    if (result.success) {
      const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
      setCatalog(
        rows.map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          brand: String(r.brand ?? ''),
          price: Number(r.price ?? 0),
          // null and 0 mean different things — see StockChip.
          availableQuantity: r.availableQuantity == null ? null : Number(r.availableQuantity),
          saleUnits: r.saleUnits,
        })),
      );
    } else {
      setCatalogError(result.error ?? 'Could not load products.');
    }
    setCatalogLoading(false);
  }, [loadProductOptions]);

  const editable = mode !== 'view';
  useEffect(() => {
    if (!editable || catalog.length || catalogLoading) return;
    void loadCatalog();
  }, [editable, catalog.length, catalogLoading, loadCatalog]);

  const onSaved = useCallback(
    (saved: OrderDetailItem) => {
      showToast(mode === 'add' ? 'Order created' : 'Order updated', 'success');
      if (mode === 'add') {
        navigation?.goBack();
        return;
      }
      setItem(saved);
      setMode('view');
      navigation?.setParams?.({ mode: 'view' });
    },
    [mode, navigation, showToast],
  );

  const onDeleted = useCallback(() => {
    showToast('Order deleted', 'success');
    navigation?.goBack();
  }, [navigation, showToast]);

  const engine = useOrderDetailForm({
    mode,
    item,
    moduleApi,
    businessId,
    onSaved,
    onDeleted,
  });

  /**
   * Per-line display data, from two sources with different jobs.
   *
   * The order's own enriched rows carry the name and brand, which is what lets view mode render
   * without fetching anything else. The catalog is consulted only for the sale-unit LADDER, which
   * the enriched rows do not carry and only edit mode needs — so in view mode the second half of
   * this map is simply empty, and correctly so.
   */
  const display = useMemo(() => {
    const map: Record<number, LineDisplay> = {};
    for (const [id, row] of Object.entries(enrichedDisplay(item))) {
      map[Number(id)] = { name: row.name, brand: row.brand, units: [] };
    }
    for (const product of catalog) {
      map[product.id] = {
        name: map[product.id]?.name || product.name,
        brand: map[product.id]?.brand || product.brand,
        units: saleUnitsOf(product),
      };
    }
    return map;
  }, [item, catalog]);

  const view = deriveDetailView({
    mode,
    loading,
    saving: engine.saving,
    hasError: !!loadError,
    hasItem: !!item,
  });

  const onEdit = useCallback(() => {
    if (!canEdit(item?.isBilled === true)) {
      showToast(lockedReason(item?.billNumber as string | null), 'error');
      return;
    }
    setMode('edit');
    navigation?.setParams?.({ mode: 'edit' });
  }, [item, navigation, showToast]);

  const onBack = useCallback(() => {
    if (mode === 'edit' && orderId != null) {
      setMode('view');
      navigation?.setParams?.({ mode: 'view' });
      return;
    }
    navigation?.goBack();
  }, [mode, orderId, navigation]);

  const onSave = useCallback(async () => {
    const result = await engine.save();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const onConfirmDelete = useCallback(async () => {
    setConfirmDelete(false);
    const result = await engine.remove();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  if (view === 'LOADING') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (view === 'ERROR') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <Text style={styles.errorTitle}>Could not load this order</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <Pressable
          onPress={() => {
            void fetchOrder();
          }}
          accessibilityRole="button"
          style={styles.retry}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <>
      <OrderDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        passthrough={engine.passthrough}
        display={display}
        slots={{ moduleLabel: config.moduleLabel }}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onPickCustomer={() => setSheet('customer')}
        onPickStatus={() => setSheet('status')}
        onAddItem={() => setSheet('products')}
        onRemoveLine={engine.removeLine}
        onUnitQty={engine.setUnitQty}
        onRemoveUnit={engine.removeUnit}
        onAddUnit={(lineIndex) => {
          // Add the first rung the line does not already carry. Which rung is not a decision worth
          // a second sheet — the chip's own dropdown is where a different unit gets chosen.
          const line = engine.form.lines[lineIndex];
          const ladder = display[line.productId]?.units ?? [];
          const present = new Set(
            (line.unitLines ?? [])
              .map((u) => u.unit)
              .concat(line.sellingUnit ? [line.sellingUnit] : []),
          );
          const next = ladder.find((u) => !present.has(u.unit));
          if (next) engine.addUnit(lineIndex, next);
        }}
        onBack={onBack}
        onEdit={onEdit}
        onSave={() => {
          void onSave();
        }}
        onDelete={() => setConfirmDelete(true)}
      />

      {/* One sheet at a time — see OpenSheet. */}
      <CustomerPickerSheet
        visible={sheet === 'customer'}
        businessId={businessId}
        onClose={() => setSheet('none')}
        onSelect={engine.setCustomer}
      />

      <OptionSheet
        visible={sheet === 'status'}
        title="Order status"
        options={STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s) }))}
        selected={engine.form.orderStatus}
        onSelect={(value) => engine.setField('orderStatus', value)}
        onClose={() => setSheet('none')}
      />

      <ProductPickerSheet
        visible={sheet === 'products'}
        subtitle={config.pickerSubtitle}
        products={catalog}
        loading={catalogLoading}
        error={catalogError}
        alreadyAdded={engine.form.lines.map((l) => l.productId)}
        onAdd={(products) => engine.addProducts(products)}
        onClose={() => setSheet('none')}
        onRetry={() => {
          void loadCatalog();
        }}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this order?"
        message="This cannot be undone. Stock deducted by the order is returned."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          void onConfirmDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default OrderDetailScreen;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
      backgroundColor: theme.palette.background,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    errorBody: { fontSize: 13, color: theme.palette.muted, textAlign: 'center' },
    retry: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
  });
}
