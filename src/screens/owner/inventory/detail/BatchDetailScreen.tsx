import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import type { InventoryStatus } from '../../../../backend/modules/shared/inventory.types';
import type { AppTheme } from '../../../../theme/theme.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import type { BatchDto } from '../batch.model';
import { canDeleteBatch, deleteBlockedReason, statusLabel } from '../batch.view';
import { baseSaleUnit, saleUnitsOf, type SaleUnit } from '../batchUnits';
import { BatchDetailBase } from './BatchDetailBase';
import { catalogBadge } from './batchDetail.model';
import {
  deriveDetailView,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  type DetailMode,
} from './batchDetail.view';
import { parlourBatchSlots } from './ParlourBatchDetail';
import { pharmacyBatchSlots } from './PharmacyBatchDetail';
import { useBatchDetailForm } from './useBatchDetailForm';

interface RouteParams {
  batchId?: number;
  mode?: DetailMode;
}

interface Props {
  route?: { params?: RouteParams };
  navigation?: {
    goBack?: () => void;
    setParams?: (params: Partial<RouteParams>) => void;
    navigate?: (route: string, params?: Record<string, unknown>) => void;
    addListener?: (event: string, cb: () => void) => (() => void) | undefined;
  };
}

/**
 * The Batch Detail route: resolves the module, fetches the record, hosts the form engine and owns
 * the modals.
 *
 * Two modes only — a batch is immutable, so there is no edit and no `setMode('edit')` anywhere.
 */
export function BatchDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const batchId = route?.params?.batchId;
  const mode: DetailMode = route?.params?.mode === 'add' ? 'add' : 'view';

  const [item, setItem] = useState<BatchDto | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);

  const [sheet, setSheet] = useState<null | 'product' | 'unit'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The two halves of the "go make a product, then come back here" round trip.
  const [pendingCreate, setPendingCreate] = useState(false);
  const [awaitingProduct, setAwaitingProduct] = useState(false);

  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [transitions, setTransitions] = useState<InventoryStatus[] | null>(null);
  const [transitionsError, setTransitionsError] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchBatch = useCallback(async () => {
    if (batchId == null) {
      setLoadError('No batch was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await activeModule.loadInventoryBatch(batchId);
    if (result?.success) setItem(result.data as BatchDto);
    else setLoadError(result?.error);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, moduleKey]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchBatch();
  }, [mode, fetchBatch]);

  /**
   * The moves this batch may make. Fetched per batch and NEVER cached — the answer depends on the
   * batch's live remaining quantity and expiry, not just its status.
   */
  const loadTransitions = useCallback(async () => {
    if (batchId == null) return;
    setTransitions(null);
    setTransitionsError(false);
    const res = await activeModule.getAllowedTransitions(batchId);
    if (res?.success) setTransitions((res.data as InventoryStatus[]) ?? []);
    else setTransitionsError(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, moduleKey]);

  useEffect(() => {
    if (mode === 'view' && item?.id != null) void loadTransitions();
    // Re-runs on the batch's STATUS too: a change opens a different set of onward moves.
  }, [mode, item?.id, item?.status, loadTransitions]);

  // The catalog is only needed to pick a product, so it is fetched when the add form opens.
  // Dropping the held rows re-arms this — that is how a just-created product gets into the list.
  useEffect(() => {
    if (!shouldLoadCatalog({ mode, hasRows: catalog.length > 0, loading: catalogLoading })) return;
    setCatalogLoading(true);
    void activeModule
      .loadProductOptions?.(500)
      .then((res: { success: boolean; data?: unknown }) => {
        if (res?.success) setCatalog((res.data as Record<string, unknown>[]) ?? []);
      })
      .finally(() => setCatalogLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, catalog.length, catalogLoading, moduleKey]);

  /**
   * Leave for the product create screen — but only once the picker Modal is actually down.
   *
   * The push is deferred to an effect rather than fired from the pill's onPress because a native
   * stack push lands UNDERNEATH a Modal that is still mounted; the user would be left staring at
   * the picker with an invisible screen behind it. The sheet closes itself first, `onClose` clears
   * `sheet`, and only then does this run.
   *
   * `ProductDetail` is registered on the INVENTORY stack, so this is a push within the current
   * stack and not a jump to the Products tab. That is what keeps this screen mounted — and with it
   * every field the user has already typed into the batch form.
   */
  useEffect(() => {
    if (!pendingCreate || sheet !== null) return;
    setPendingCreate(false);
    setAwaitingProduct(true);
    navigation?.navigate?.('ProductDetail', { mode: 'add' });
  }, [pendingCreate, sheet, navigation]);

  /**
   * Coming back from that trip: refresh the catalog and drop the user back in the picker.
   *
   * The first focus is skipped for the reason every screen in this app skips it — a screen fires
   * focus on mount, and acting on that would reopen the picker over a form nobody has touched.
   * Note the picker's own `query` and `picked` do NOT survive (the Modal is unmounted while we are
   * away); the batch form underneath does, which is the state that actually matters.
   */
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      const isFirstFocus = !hasFocusedRef.current;
      hasFocusedRef.current = true;
      if (!shouldResumeProductPick({ awaitingProduct, isFirstFocus })) return;
      setAwaitingProduct(false);
      setCatalog([]);
      setSheet('product');
    });
    return unsubscribe;
  }, [navigation, awaitingProduct]);

  const onSaved = useCallback(() => {
    showToast('Batch added', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const onDeleted = useCallback(() => {
    showToast('Batch deleted', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const engine = useBatchDetailForm({
    mode,
    item,
    moduleApi: activeModule,
    businessId,
    onSaved,
    onDeleted,
  });

  /** The chosen product's ladder, for the Stock-in Unit picker and every base-unit label. */
  const selected = useMemo(
    () => catalog.find((p) => Number((p as { id?: number }).id) === engine.form.itemId),
    [catalog, engine.form.itemId],
  );
  const saleUnits: SaleUnit[] = useMemo(() => saleUnitsOf(selected), [selected]);
  const baseUnit = useMemo(
    () =>
      baseSaleUnit(saleUnits)?.unit ||
      String((selected as { stockUnit?: string })?.stockUnit || 'unit'),
    [saleUnits, selected],
  );

  const catalogRows: CatalogRow[] = useMemo(
    () =>
      catalog.map((p) => {
        const row = p as { id: number; name?: string; brand?: string; price?: number };
        return {
          id: Number(row.id),
          name: String(row.name ?? `Product #${row.id}`),
          price: Number(row.price ?? 0),
          subtitle: row.brand ? String(row.brand) : undefined,
          badge: catalogBadge(p),
          raw: p,
        };
      }),
    [catalog],
  );

  const onSave = useCallback(async () => {
    const result = await engine.save();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const onConfirmDelete = useCallback(async () => {
    setConfirmDelete(false);
    const result = await engine.remove();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const onChangeStatus = useCallback(
    async (next: InventoryStatus) => {
      if (item?.id == null) return;
      const res = await activeModule.updateBatchStatus(item.id, next);
      if (!res?.success) {
        showToast(res?.error || 'Could not change the status', 'error');
        return;
      }
      showToast(`Batch moved to ${statusLabel(next)}`, 'success');
      // Refetch rather than patch: a status change can also flip derived fields server-side.
      void fetchBatch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, moduleKey, fetchBatch, showToast],
  );

  const view = deriveDetailView({
    mode,
    loading,
    saving: engine.saving,
    hasError: !!loadError,
    hasItem: !!item,
  });

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
        <Text style={styles.errorText}>{loadError ?? engine.saveError}</Text>
      </SafeAreaView>
    );
  }

  const slots = moduleKey === 'PHARMACY' ? pharmacyBatchSlots() : parlourBatchSlots();
  const blocked = mode === 'view' && item ? deleteBlockedReason(item) : null;

  return (
    <>
      <BatchDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        saleUnits={saleUnits}
        baseUnit={baseUnit}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onPickProduct={() => setSheet('product')}
        onPickUnit={() => setSheet('unit')}
        transitions={transitions}
        transitionsError={transitionsError}
        onRetryTransitions={loadTransitions}
        onChangeStatus={onChangeStatus}
        onBack={() => navigation?.goBack?.()}
        onSave={mode === 'add' ? onSave : undefined}
        onDelete={item && canDeleteBatch(item) ? () => setConfirmDelete(true) : undefined}
        deleteBlockedReason={blocked}
      />

      {/* Single-select: a batch belongs to exactly one product, so tapping confirms. */}
      {sheet === 'product' ? (
        <CatalogPickerSheet
          visible
          singleSelect
          title="Select Product"
          subtitle={mode === 'add' ? 'New batch' : ''}
          helper="Same catalog for Product & Raw — the type just sets which pool the batch lands in."
          searchPlaceholder="Search name or brand"
          noun="product"
          rows={catalogRows}
          loading={catalogLoading}
          error={null}
          alreadyAdded={[]}
          onCreateNew={
            showsCreateProduct(mode) ? () => setPendingCreate(true) : undefined
          }
          onAdd={(rows) => {
            const picked = rows[0];
            if (!picked) return;
            const units = saleUnitsOf(picked.raw);
            const base = baseSaleUnit(units);
            engine.setProduct({
              id: picked.id,
              name: picked.name,
              unit: base?.unit ?? '',
              multiplier: base?.perStock ?? 1,
            });
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'unit' ? (
        <OptionSheet
          visible
          title="Stock-in unit"
          options={saleUnits.map((u) => ({
            value: u.unit,
            label: u.unit,
            sub: u.perStock > 1 ? `${u.perStock} ${baseUnit}s` : 'Base unit',
          }))}
          selected={engine.form.stockInUnit}
          onSelect={(value) => {
            const picked = saleUnits.find((u) => u.unit === value);
            engine.setField('stockInUnit', value);
            engine.setField('stockInMultiplier', picked?.perStock ?? 1);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          visible
          title="Delete this batch?"
          message="This cannot be undone. Only batches that have never been drawn from can be deleted."
          confirmLabel="Delete"
          danger
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.palette.background,
    },
    errorText: { fontSize: 14, color: theme.palette.error, textAlign: 'center' },
  });
}
