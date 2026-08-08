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
import type { StockTransferDto } from '../../../../backend/modules/shared/stockTransfer.types';
import type { AppTheme } from '../../../../theme/theme.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import type { BatchDto } from '../../inventory/batch.model';
import { baseSaleUnit, saleUnitsOf, type SaleUnit } from '../../inventory/batchUnits';
import {
  deleteRefusalMessage,
  deleteSuccessMessage,
  poolLabel,
} from '../stockTransfer.view';
import {
  aggregatePoolStock,
  availabilityHelper,
  outOfStockNote,
  pickerStock,
  poolStockFor,
  rowIsOutOfStock,
  type PoolStock,
} from '../poolStock';
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
 * One page of the source pool's ACTIVE batches is enough to answer every stock question this screen
 * asks. 500 is the same cap `loadProductOptions` uses on the catalog, and for the same reason: the
 * picker only needs a total, and paging silently would hide the fact that it was capped.
 *
 * ⚠️ What the cap costs, now that the aggregate also names `sourceBatchId`: past 500 ACTIVE batches
 * in one pool the totals understate the stock and the resolved batch may not be the true lowest id.
 * Both errors fall on the SAFE side — a low ceiling refuses a transfer that would have worked, and a
 * higher-id starting batch simply has the server begin its overflow further along a list it walks
 * itself. Neither can move the wrong stock. If a business ever gets near this, page it rather than
 * raise the number.
 */
const POOL_BATCH_LIMIT = 500;

/**
 * A catalog row's base unit.
 *
 * Resolved PER ROW rather than from the selected product: the picker draws every product's stock at
 * once, and rendering them all in the selected one's unit would report grams as millilitres. Falls
 * back to the product's own `stockUnit`, then to the generic "unit".
 */
function baseUnitOf(product: unknown): string {
  return (
    baseSaleUnit(saleUnitsOf(product))?.unit ||
    String((product as { stockUnit?: string })?.stockUnit || 'unit')
  );
}

/**
 * ⚠️ `getSelectedBusinessId` resolves ASYNC, so `businessId` is null for the first render or two.
 * Every fetch below is gated on it rather than defaulting to 0 — a `businessId=0` query is a 400
 * that would land after the real one and blank a screen that had already loaded.
 */

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

  /**
   * ⚠️ Pull the individual callbacks out, and never depend on `activeModule` itself.
   *
   * `createModuleHook` returns a fresh object literal on every render, so a `useMemo` or effect that
   * lists `activeModule` in its deps re-runs on every render — and a fetch effect that re-runs on
   * every render sets state, which renders, which fetches again. That is an unbounded request loop
   * and it is silent: the screen sits on its spinner while hammering the server. The callbacks below
   * are each `useCallback`-stable, so depending on THEM is safe. Same rule as `OrderDetailScreen`.
   */
  const {
    loadStockTransfer,
    createStockTransfer,
    deleteStockTransfer,
    loadProductOptions,
    loadInventoryByBusiness,
  } = activeModule;

  const recordApi = useMemo(
    () => ({ createStockTransfer, deleteStockTransfer }),
    [createStockTransfer, deleteStockTransfer],
  );

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

  /**
   * The SOURCE pool's stock, per product.
   *
   * ⚠️ Null until the first response lands, and that is NOT the same as an empty map: an empty map
   * means "asked, and this pool holds nothing", which greys every picker row out. Null means "still
   * asking", and every row stays tappable.
   */
  const [pool, setPool] = useState<Map<number, PoolStock> | null>(null);

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
    const result = await loadStockTransfer(stockTransferId);
    if (result?.success) setItem(result.data as StockTransferDto);
    else setLoadError(result?.error ?? 'Could not load this transfer.');
    setLoading(false);
  }, [stockTransferId, loadStockTransfer]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchRecord();
  }, [mode, fetchRecord]);

  // The catalog is only needed to pick a product, so it is fetched when the form opens. Dropping
  // the held rows re-arms this — that is how a just-created product gets into the list.
  useEffect(() => {
    if (!shouldLoadCatalog({ mode, hasRows: catalog.length > 0, loading: catalogLoading })) return;
    setCatalogLoading(true);
    void loadProductOptions?.(500)
      .then((res: { success: boolean; data?: unknown }) => {
        if (res?.success) setCatalog((res.data as Record<string, unknown>[]) ?? []);
      })
      .finally(() => setCatalogLoading(false));
  }, [mode, catalog.length, catalogLoading, loadProductOptions]);

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
    // Says the stock went BACK — a delete here reverses the move rather than tidying a record away.
    showToast(deleteSuccessMessage(), 'success');
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
  const baseUnit = useMemo(() => baseUnitOf(selected), [selected]);

  /**
   * The SOURCE pool's stock, per product, in ONE request.
   *
   * The obvious call is `getTotalStock(itemId, businessId, sourceType)` — which is one request PER
   * PRODUCT, so a 500-row catalog would be 500 requests to draw one picker. One page of the pool's
   * ACTIVE batches answers the question for every product at once, and `aggregatePoolStock` sums it.
   *
   * ⚠️ Keyed on `form.sourceType`, so it REFETCHES when the direction flips. Not optional: flipping
   * swaps which pool is the source, and with it both the ceiling on the quantity and which rows are
   * pickable — after a flip, a product with Product stock and no Raw stock becomes the unpickable
   * one. Every other dependency here is a primitive or a `useCallback`-stable function, so this
   * effect runs when one of those genuinely changes and not once per render.
   */
  const sourceType = engine.form.sourceType;
  useEffect(() => {
    if (mode !== 'add' || businessId == null) return;
    let alive = true;
    void loadInventoryByBusiness(
      businessId,
      { inventoryType: sourceType, status: 'ACTIVE' },
      1,
      POOL_BATCH_LIMIT,
    ).then((res: { success: boolean; data?: unknown }) => {
      if (!alive) return;
      // A failure yields an EMPTY map rather than leaving the last pool's answer on screen, which
      // after a flip would be the wrong pool's stock presented as this one's.
      setPool(aggregatePoolStock(res?.success ? (res.data as BatchDto[]) : []));
    });
    return () => {
      alive = false;
    };
  }, [mode, businessId, sourceType, loadInventoryByBusiness]);

  /** The chosen product's stock in the source pool. Null until the pool answers; null is NOT zero. */
  const selectedStock = useMemo(
    () => poolStockFor(pool, engine.form.itemId),
    [pool, engine.form.itemId],
  );
  const availableBaseQty: number | null = selectedStock ? selectedStock.baseQty : null;
  /**
   * The batch the POST is addressed by — the lowest-id ACTIVE batch with stock in the SOURCE pool.
   *
   * ⚠️ `undefined` while the pool has not answered, `null` once it has and there is nothing to draw
   * from. `validateStockTransfer` treats those two differently on purpose: collapsing them would
   * refuse every save in the moment between opening the form and the batches landing.
   *
   * Re-resolves with `selectedStock`, which is keyed on the source pool — so a direction flip picks
   * a batch from the other pool without anything here having to remember to.
   */
  const sourceBatchId = selectedStock ? selectedStock.sourceBatchId : undefined;
  const availabilityText = useMemo(
    () => availabilityHelper(selectedStock, baseUnit, sourceType),
    [selectedStock, baseUnit, sourceType],
  );

  /**
   * The picker rows: name · brand on the left with the price, and the SOURCE-pool stock on the right.
   *
   * `price` stays alongside the stock figure rather than being displaced by it — they are two slots,
   * as every picker mockup draws them.
   *
   * ⚠️ A product with no stock in the source pool is rendered INERT with a note, because tapping it
   * could only ever produce a server refusal. The figure follows the direction: after a flip, a
   * product with Product stock and no Raw stock becomes the unpickable one.
   */
  const catalogRows: CatalogRow[] = useMemo(
    () =>
      catalog.map((p) => {
        const row = p as { id: number; name?: string; brand?: string; price?: number };
        const id = Number(row.id);
        const stock = poolStockFor(pool, id);
        return {
          id,
          name: String(row.name ?? `Product #${row.id}`),
          price: Number(row.price ?? 0),
          subtitle: row.brand ? String(row.brand) : undefined,
          stock: pickerStock(stock, baseUnitOf(p)),
          disabled: rowIsOutOfStock(stock),
          disabledNote: outOfStockNote(stock, sourceType),
          raw: p,
        };
      }),
    [catalog, pool, sourceType],
  );

  const onSave = useCallback(async () => {
    // The ceiling rides in as an argument — see `useStockTransferDetailForm.save` for why it cannot
    // be an input to the hook.
    const result = await engine.save({ availableBaseQty, baseUnit, sourceBatchId });
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, availableBaseQty, baseUnit, sourceBatchId, showToast]);

  const onConfirmDelete = useCallback(async () => {
    setConfirmDelete(false);
    const result = await engine.remove();
    if (!result.success) {
      // ⚠️ A 409 `STOCK_MOVEMENT_LOCKED` is the system protecting stock, not a failure: the
      // destination batch has been drawn from, so reversing the move would take back something that
      // has already been sold or consumed. `deleteRefusalMessage` says that; a generic "could not
      // delete" would read as a bug.
      showToast(deleteRefusalMessage(result.code, result.error), 'error');
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
        availabilityText={availabilityText}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onChangeDirection={engine.setDirection}
        onChangeReason={engine.setReason}
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
          // Names the pool the figures came from, and FOLLOWS the direction — after a flip the same
          // rows show different numbers, and a fixed "Product (source)" would be a lie half the time.
          helper={`Showing stock in the ${poolLabel(sourceType)} (source) pool`}
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

      {/*
        The unit sheet for the SINGLE row.

        Gated on `sheet === 'unit'` rather than on a `visible` prop, which is what keeps it from ever
        being mounted alongside the picker — on react-native-web a dismissed Modal's portal stays
        mounted and swallows taps meant for whatever is beneath it.

        Writes the chosen rung's `unit` AND `perStock` together: the multiplier is what converts the
        typed figure into base units, so a row left on the previous rung's multiplier would move a
        different amount of stock than the number on screen says.
      */}
      {sheet === 'unit' ? (
        <OptionSheet
          visible
          title="Unit"
          options={saleUnits.map((u) => ({
            value: u.unit,
            label: u.unit,
            sub: u.perStock > 1 ? `${u.perStock} ${baseUnit} per ${u.unit}` : undefined,
          }))}
          selected={engine.form.unitRows[0]?.unit ?? null}
          onSelect={(value) => {
            const rung = saleUnits.find((u) => u.unit === value);
            if (!rung) return;
            engine.setUnitRows(
              engine.form.unitRows.length
                ? engine.form.unitRows.map((r, i) =>
                    i === 0 ? { ...r, unit: rung.unit, perStock: rung.perStock } : r,
                  )
                : [{ unit: rung.unit, perStock: rung.perStock, qty: 0 }],
            );
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

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
