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
import type {
  StockTransferDto,
  StockTransferPayload,
} from '../../../../backend/modules/shared/stockTransfer.types';
import type { AppTheme } from '../../../../theme/theme.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import { baseSaleUnit, saleUnitsOf, type SaleUnit } from '../../inventory/batchUnits';
import { StockTransferDetailBase } from './StockTransferDetailBase';
import {
  deriveDetailView,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  type DetailMode,
} from './stockTransferDetail.view';
import { parlourStockTransferSlots } from './ParlourStockTransferDetail';
import { pharmacyStockTransferSlots } from './PharmacyStockTransferDetail';
import { useStockTransferDetailForm } from './useStockTransferDetailForm';

interface RouteParams {
  stockTransferId?: number;
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
 * FEATURE: the module-hook wiring — do this FIRST.
 *
 * `useModuleService.ts` carries a labelled but EMPTY `─── Stock Transfer ───` region at each of its
 * four edit sites. Fill it by copying the consumption slice, then replace the three bodies below
 * with `activeModule.loadStockTransfer`, `.createStockTransfer` and `.deleteStockTransfer` and
 * delete this function.
 *
 * ⚠️ `deleteStockTransfer` must RESOLVE `{ success: false, code: 'STOCK_MOVEMENT_LOCKED', error }`
 * on a 409 rather than throwing — that is the one way the transfer slice differs from the
 * consumption one it is copied from.
 */
function useStockTransferRecordApi(_activeModule: unknown) {
  const notWired = {
    success: false,
    error: 'Stock transfers are not wired to the module hook yet.',
  };
  return {
    loadOne: async (_id: number): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      notWired,
    createStockTransfer: async (_data: StockTransferPayload) => notWired,
    deleteStockTransfer: async (
      _id: number,
    ): Promise<{
      success: boolean;
      code?: string;
      error?: string;
    }> => notWired,
  };
}

/**
 * The Stock Transfer Detail route: resolves the module, fetches the record, hosts the form engine
 * and owns the modals.
 *
 * Two modes only — a transfer is immutable, so there is no edit and no `setMode('edit')`.
 */
export function StockTransferDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const recordApi = useStockTransferRecordApi(activeModule);

  const stockTransferId = route?.params?.stockTransferId;
  const mode: DetailMode = route?.params?.mode === 'add' ? 'add' : 'view';

  const [item, setItem] = useState<StockTransferDto | null>(null);
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

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchRecord = useCallback(async () => {
    if (stockTransferId == null) {
      setLoadError('No transfer was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await recordApi.loadOne(stockTransferId);
    if (result?.success) setItem(result.data as StockTransferDto);
    else setLoadError(result?.error ?? 'Could not load this transfer.');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockTransferId, moduleKey]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchRecord();
  }, [mode, fetchRecord]);

  // The catalog is only needed to pick a product, so it is fetched when the form opens. Dropping
  // the held rows re-arms this — that is how a just-created product gets into the list.
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
   * the picker with an invisible screen behind it.
   *
   * `ProductDetail` is registered on the STOCK TRANSFERS stack, so this is a push within the
   * current stack and not a jump to the Products tab. That is what keeps this screen mounted — and
   * with it every field the user has already filled in.
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
    showToast('Stock transferred', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const onDeleted = useCallback(() => {
    // FEATURE: say that the stock went BACK — a delete here reverses the move.
    showToast('Transfer deleted', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const engine = useStockTransferDetailForm({
    mode,
    item,
    moduleApi: recordApi,
    businessId,
    onSaved,
    onDeleted,
  });

  /** The chosen product's ladder, for the row's unit picker and every base-unit label. */
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

  /**
   * FEATURE: stock on hand for the chosen product IN THE SOURCE POOL, in base units.
   *
   * `getTotalStock(itemId, businessId, form.sourceType)` is the call, and it has to re-run when the
   * DIRECTION flips as well as when the product changes — flipping swaps which pool is the source,
   * and with it the ceiling on the quantity. Null until it answers; null is NOT zero.
   */
  const availableBaseQty: number | null = null;

  /**
   * FEATURE: the picker rows.
   *
   * The mockup's row is name · brand · type chip · price on the left, and the SOURCE-pool stock
   * total with its breakdown on the right. `price` stays required — the stock slot sits BESIDE it,
   * not instead of it. Fill `stock` from `getTotalStock` + `formatStockedQty`, and set `disabled` +
   * `disabledNote` at zero so the row is inert rather than a guaranteed refusal. ⚠️ The figure must
   * follow the direction: after a flip, a product with Product stock and no Raw stock becomes the
   * unpickable one.
   */
  const catalogRows: CatalogRow[] = useMemo(
    () =>
      catalog.map((p) => {
        const row = p as { id: number; name?: string; brand?: string; price?: number };
        return {
          id: Number(row.id),
          name: String(row.name ?? `Product #${row.id}`),
          price: Number(row.price ?? 0),
          subtitle: row.brand ? String(row.brand) : undefined,
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
    if (!result.success && result.error) {
      // FEATURE: branch on `result.code === 'STOCK_MOVEMENT_LOCKED'` and say WHY — the destination
      // FEATURE: batch has been drawn from, so the move can no longer be reversed. A generic
      // FEATURE: failure message would read as a bug rather than as the system protecting stock.
      showToast(result.error, 'error');
    }
  }, [engine, showToast]);

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

  const slots =
    moduleKey === 'PHARMACY' ? pharmacyStockTransferSlots() : parlourStockTransferSlots();

  return (
    <>
      <StockTransferDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        ladderSize={saleUnits.length}
        baseUnit={baseUnit}
        availableBaseQty={availableBaseQty}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onChangeDirection={engine.setDirection}
        onPickProduct={() => setSheet('product')}
        onChangeUnitRows={(rows) => engine.setUnitRows(rows)}
        onPickRowUnit={() => setSheet('unit')}
        onBack={() => navigation?.goBack?.()}
        onSave={mode === 'add' ? onSave : undefined}
        onDelete={mode === 'view' && item ? () => setConfirmDelete(true) : undefined}
      />

      {/* Single-select: a transfer moves exactly one product, so tapping confirms. */}
      {sheet === 'product' ? (
        <CatalogPickerSheet
          visible
          singleSelect
          title="Select Product"
          subtitle={mode === 'add' ? 'New transfer' : ''}
          helper="Showing stock in the Product (source) pool"
          searchPlaceholder="Search name or brand"
          noun="product"
          rows={catalogRows}
          loading={catalogLoading}
          error={null}
          alreadyAdded={[]}
          onCreateNew={showsCreateProduct(mode) ? () => setPendingCreate(true) : undefined}
          onAdd={(picked) => {
            const row = picked[0];
            if (!row) return;
            const units = saleUnitsOf(row.raw);
            const base = baseSaleUnit(units);
            engine.setProduct({
              id: row.id,
              name: row.name,
              unit: base?.unit ?? '',
              multiplier: base?.perStock ?? 1,
            });
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {/* FEATURE: the unit sheet for the single row. An `OptionSheet` over `saleUnits`, writing the
          chosen rung's `unit` and `perStock` back into it. Never mount it while the picker is up —
          two Modals at once is the never-two-Modals rule. */}

      {confirmDelete ? (
        <ConfirmDialog
          visible
          title="Delete this transfer?"
          message="The moved quantity goes back to the pool it came from. This is refused once the destination batch has been used."
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
