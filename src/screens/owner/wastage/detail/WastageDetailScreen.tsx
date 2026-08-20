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
import type { WastageDto, WastagePayload } from '../../../../backend/modules/shared/wastage.types';
import type { AppTheme } from '../../../../theme/theme.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import {
  POOL_BATCH_LIMIT,
  aggregatePoolStock,
  outOfStockNote,
  pickerStock,
  poolStockFor,
  rowIsOutOfStock,
  type PoolStock,
} from '../../shared/detail/poolStock';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import {
  baseSaleUnit,
  saleUnitsOf,
  type SaleUnit,
} from '../../inventory/batchUnits';
import { WastageDetailBase } from './WastageDetailBase';
import {
  availabilityHelper,
  availableBaseQty as sumAvailableBaseQty,
  pickWriteOffBatch,
  recordBaseUnit,
  type WriteOffBatch,
} from './wastageDetail.model';
import {
  deriveDetailView,
  pickerHelper,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  type DetailMode,
} from './wastageDetail.view';
import { parlourWastageSlots } from './ParlourWastageDetail';
import { pharmacyWastageSlots } from './PharmacyWastageDetail';
import { useWastageDetailForm } from './useWastageDetailForm';

interface RouteParams {
  wastageId?: number;
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

interface WastageModuleApi {
  /**
   * `error` is required here alone of the three: this is the read whose message the screen renders
   * as its load banner, and `loadWastage` always fills it. Declared optional, the banner needed a
   * `?? 'Could not load this wastage.'` of its own to compile — copy the hook's own sentence had
   * already made unreachable.
   */
  loadWastage: (id: number) => Promise<{ success: boolean; data?: unknown; error: string | null }>;
  createWastage: (
    data: WastagePayload,
  ) => Promise<{ success: boolean; data?: unknown; error?: string | null }>;
  deleteWastage: (id: number) => Promise<{ success: boolean; error?: string | null }>;
}

/**
 * The module hook's wastage slice, wrapped so its identity is stable between renders.
 *
 * The `useMemo` is load-bearing rather than an optimisation: this object is handed to
 * `useWastageDetailForm`, which puts it in a `useCallback` dependency list. A fresh object literal
 * per render would rebuild `save` and `remove` on every render — and the sibling list screen has
 * already been bitten once by exactly this shape of bug, where a new identity per render drove an
 * effect that set state into a loop. Jest here never renders, so nothing would catch it.
 */
function useWastageRecordApi(activeModule: WastageModuleApi, moduleKey: string) {
  const { loadWastage, createWastage, deleteWastage } = activeModule;
  return useMemo(
    () => ({
      loadOne: (id: number) => loadWastage(id),
      createWastage: (data: WastagePayload) => createWastage(data),
      deleteWastage: (id: number) => deleteWastage(id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadWastage, createWastage, deleteWastage, moduleKey],
  );
}

/**
 * The Wastage Detail route: resolves the module, fetches the record, hosts the form engine and owns
 * the modals.
 *
 * Two modes only — a wastage is immutable, so there is no edit and no `setMode('edit')`.
 */
export function WastageDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const recordApi = useWastageRecordApi(activeModule, moduleKey);

  const wastageId = route?.params?.wastageId;
  const mode: DetailMode = route?.params?.mode === 'add' ? 'add' : 'view';

  const [item, setItem] = useState<WastageDto | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);

  const [sheet, setSheet] = useState<null | 'product' | 'unit'>(null);
  /** Which unit row the unit sheet is editing. Null when the sheet is not up. */
  const [unitRowIndex, setUnitRowIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /**
   * The chosen product's batches IN THE CHOSEN POOL.
   *
   * One request answers three questions at once — which batch to address the payload to, how much
   * is on hand, and what the printed batch numbers are — which is why it is a batch list rather
   * than a `getTotalStock` call. Frozen empty-array default so its identity is stable when nothing
   * has been fetched.
   */
  const [batches, setBatches] = useState<WriteOffBatch[] | null>(null);

  /**
   * Stock on hand for the chosen product IN THE CHOSEN POOL, and the batch to address the write-off
   * to.
   *
   * Both come off the ONE batch fetch below, because both answers are in it and a `getTotalStock`
   * call would give only the first. Null until it answers — null is NOT zero, and the quantity
   * roll-up drops its " of N available" tail rather than claiming an empty shelf.
   *
   * `writeOffBatchId` is the payload's addressing field: the lowest-id ACTIVE batch with stock. The
   * server overflows into later batches by itself, so this is a starting point rather than a split.
   */
  const availableBaseQty = useMemo(
    () => (batches ? sumAvailableBaseQty(batches) : null),
    [batches],
  );
  const writeOffBatchId = useMemo(() => pickWriteOffBatch(batches), [batches]);

  // The two halves of the "go make a product, then come back here" round trip.
  const [pendingCreate, setPendingCreate] = useState(false);
  const [awaitingProduct, setAwaitingProduct] = useState(false);

  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  /**
   * Every product's stock in the CURRENTLY SELECTED pool, for the picker's per-row figure.
   *
   * `null` means "not asked yet" and is not the same as an empty map, which means "asked, and the
   * pool holds nothing" — the rows draw no stock in the first case and a disabled zero in the
   * second. Collapsing the two would brand every row out-of-stock for the moment before the
   * batches land.
   *
   * This replaces reading `availableQuantity` off the catalog row, which is the SELLABLE figure and
   * has no raw counterpart: on the Raw pool the picker previously showed nothing at all and
   * disabled nothing, so a product holding no raw stock looked pickable and failed on save.
   */
  const [poolStock, setPoolStock] = useState<Map<number, PoolStock> | null>(null);

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
    if (wastageId == null) {
      setLoadError('No wastage was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await recordApi.loadOne(wastageId);
    if (result?.success) setItem(result.data as WastageDto);
    else setLoadError(result?.error);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wastageId, moduleKey]);

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
   * `ProductDetail` is registered on the WASTAGE stack, so this is a push within the current stack
   * and not a jump to the Products tab. That is what keeps this screen mounted — and with it every
   * field the user has already filled in.
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
    showToast('Wastage recorded', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const onDeleted = useCallback(() => {
    // Says the stock came BACK. A delete here is a reversal, and a bare "Deleted" hides the thing
    // the user most needs to know about what just happened to their inventory.
    showToast('Wastage deleted · stock restocked', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const engine = useWastageDetailForm({
    mode,
    item,
    moduleApi: recordApi,
    businessId,
    batchId: writeOffBatchId,
    availableBaseQty,
    onSaved,
    onDeleted,
  });

  /**
   * The chosen product's batches in the chosen pool.
   *
   * ⚠️ Re-runs on the POOL as well as on the product. That is the difference from consumption,
   * where the pool is fixed to RAW: here the same product can hold different stock in each pool, so
   * switching the toggle changes the available figure, the batch the payload addresses, AND the
   * ceiling the validator checks against. Watching only `itemId` would leave all three describing
   * the pool the user just switched away from.
   *
   * In view mode it reads the SAVED record's product and pool instead, purely so the ledger can
   * print batch numbers rather than ids.
   */
  const scopeItemId = mode === 'add' ? engine.form.itemId : (item?.itemId ?? null);
  const scopePool =
    mode === 'add' ? engine.form.inventoryType : (item?.inventoryType ?? 'PRODUCT_INVENTORY');
  useEffect(() => {
    if (businessId == null || scopeItemId == null) {
      setBatches(null);
      return;
    }
    let alive = true;
    void activeModule
      .loadInventoryByProduct?.(scopeItemId, businessId, scopePool)
      .then((res: { success: boolean; data?: unknown }) => {
        if (!alive) return;
        // `[]` on failure rather than null: null means "not asked yet" and would leave the form
        // claiming the answer is still coming.
        setBatches(res?.success ? ((res.data as WriteOffBatch[]) ?? []) : []);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, scopeItemId, scopePool, moduleKey]);

  /**
   * One request per POOL, not one per product.
   *
   * `getTotalStock(itemId, businessId, pool)` would answer the same question a row at a time, which
   * is 500 requests to draw one picker. A single `/byBusiness?inventoryType=…&status=ACTIVE`
   * returns every batch in the pool and summing by `itemId` answers every row at once.
   *
   * Keyed on the POOL, so flipping the Product/Raw toggle re-derives all of it — the figure on each
   * row, and which rows are inert. Watching only `businessId` would leave the picker describing the
   * pool the user just switched away from, which is the bug this whole change exists to fix.
   *
   * Add mode only: the read view has a saved record and nothing to pick.
   */
  useEffect(() => {
    if (mode !== 'add' || businessId == null) {
      setPoolStock(null);
      return;
    }
    let alive = true;
    setPoolStock(null);
    void activeModule
      .loadInventoryByBusiness?.(
        businessId,
        { inventoryType: engine.form.inventoryType, status: 'ACTIVE' },
        1,
        POOL_BATCH_LIMIT,
      )
      .then((res: { success: boolean; data?: unknown }) => {
        if (!alive) return;
        // An empty map on failure, not null: null would leave the rows claiming the answer is still
        // coming, and they would sit there blank forever.
        setPoolStock(aggregatePoolStock(res?.success ? ((res.data as never[]) ?? []) : []));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, businessId, engine.form.inventoryType, moduleKey]);

  /** The chosen product's ladder, for the unit picker on each row and every base-unit label. */
  const selected = useMemo(
    () => catalog.find((p) => Number((p as { id?: number }).id) === engine.form.itemId),
    [catalog, engine.form.itemId],
  );
  const saleUnits: SaleUnit[] = useMemo(() => saleUnitsOf(selected), [selected]);
  const catalogBaseUnit = useMemo(
    () =>
      baseSaleUnit(saleUnits)?.unit ||
      String((selected as { stockUnit?: string })?.stockUnit || 'unit'),
    [saleUnits, selected],
  );
  // The read screen never fetches the catalog, so the base unit has to come off the record there —
  // otherwise the hero renders "600 unit" for a row the list already shows as "600 ml".
  const baseUnit = mode === 'add' ? catalogBaseUnit : recordBaseUnit(item, catalogBaseUnit);

  const availabilityLine = useMemo(
    () => availabilityHelper(batches, baseUnit),
    [batches, baseUnit],
  );
  /** Batch id → printed number, so the ledger names batches rather than numbering them. */
  const batchNumbers = useMemo(() => {
    const map: Record<number, string> = {};
    for (const b of batches ?? []) {
      if (b?.id != null && b?.batchNumber) map[Number(b.id)] = String(b.batchNumber);
    }
    return map;
  }, [batches]);

  /**
   * The picker rows: name · brand · type chip · price on the left, stock on the right.
   *
   * `price` stays required — the stock slot sits BESIDE it, not instead of it — and there is no
   * thumbnail, which the shared sheet dropped for every caller.
   *
   * The stock figure is drawn for BOTH pools, from `poolStock` rather than from the catalog row's
   * `availableQuantity` — that field is the SELLABLE figure with no raw counterpart, so on Raw it
   * used to leave every row blank and pickable, and a product holding no raw stock only failed on
   * save. The picker's helper line names whichever pool it is describing, so the two agree.
   */
  const catalogRows: CatalogRow[] = useMemo(
    () =>
      catalog.map((p) => {
        const row = p as {
          id: number;
          name?: string;
          brand?: string;
          price?: number;
          productType?: string;
        };
        const id = Number(row.id);
        const units = saleUnitsOf(p);
        const unit = baseSaleUnit(units)?.unit || 'unit';
        const stock = poolStockFor(poolStock, id);
        const out = rowIsOutOfStock(stock);
        return {
          id,
          name: String(row.name ?? `Product #${row.id}`),
          price: Number(row.price ?? 0),
          subtitle: row.brand ? String(row.brand) : undefined,
          badge: row.productType
            ? { label: String(row.productType), tone: 'muted' as const }
            : undefined,
          stock: pickerStock(stock, unit),
          // Inert at zero rather than a guaranteed refusal: tapping it could only ever produce a
          // server "no stock" the user cannot act on from inside the picker.
          disabled: out,
          disabledNote: outOfStockNote(stock, engine.form.inventoryType),
          raw: p,
        };
      }),
    [catalog, poolStock, engine.form.inventoryType],
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

  const slots = moduleKey === 'PHARMACY' ? pharmacyWastageSlots() : parlourWastageSlots();

  return (
    <>
      <WastageDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        ladderSize={saleUnits.length}
        baseUnit={baseUnit}
        availableBaseQty={availableBaseQty}
        availabilityLine={availabilityLine}
        batchNumbers={batchNumbers}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onPickProduct={() => setSheet('product')}
        onChangeUnitRows={(rows) => engine.setUnitRows(rows)}
        onPickRowUnit={(index) => {
          setUnitRowIndex(index);
          setSheet('unit');
        }}
        onBack={() => navigation?.goBack?.()}
        onSave={mode === 'add' ? onSave : undefined}
        onDelete={mode === 'view' && item ? () => setConfirmDelete(true) : undefined}
      />

      {/* Single-select: a wastage is recorded against exactly one product, so tapping confirms. */}
      {sheet === 'product' ? (
        <CatalogPickerSheet
          visible
          singleSelect
          title="Select Product"
          subtitle={mode === 'add' ? 'New wastage' : ''}
          // Names whichever pool the stock column is actually describing — see `pickerHelper`.
          helper={pickerHelper(engine.form.inventoryType)}
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

      {/* The per-row unit picker. Gated on `sheet === 'unit'` and therefore never mounted while
          the product picker is up — two Modals at once is the never-two-Modals rule, and on
          react-native-web the loser's portal stays mounted and eats taps. */}
      {sheet === 'unit' && unitRowIndex !== null ? (
        <OptionSheet
          visible
          title="Unit"
          options={saleUnits.map((u) => ({
            value: u.unit,
            label: u.unit,
            sub: u.perStock > 1 ? `${u.perStock} ${baseUnit} per ${u.unit}` : undefined,
          }))}
          selected={engine.form.unitRows[unitRowIndex]?.unit ?? null}
          onSelect={(value) => {
            const rung = saleUnits.find((u) => u.unit === value);
            if (!rung) return;
            // Both fields together: `perStock` is what the quantity is multiplied by, so writing the
            // name without it would convert the entry through the previous rung's multiplier.
            engine.setUnitRows(
              engine.form.unitRows.map((r, i) =>
                i === unitRowIndex ? { ...r, unit: rung.unit, perStock: rung.perStock } : r,
              ),
            );
          }}
          onClose={() => {
            setSheet(null);
            setUnitRowIndex(null);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          visible
          title="Delete this wastage?"
          message="The written-off quantity is returned to the batches it came from."
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
