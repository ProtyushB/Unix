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
import type { ConsumptionDto } from '../../../../backend/modules/shared/consumption.types';
import type { AppTheme } from '../../../../theme/theme.types';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import { baseSaleUnit, saleUnitsOf, type SaleUnit } from '../../inventory/batchUnits';
import type { BatchDto } from '../../inventory/batch.model';
import { catalogBadge } from '../../inventory/detail/batchDetail.model';
import { batchText, recordQtyParts } from '../consumption.model';
import { ConsumptionDetailBase } from './ConsumptionDetailBase';
import {
  CONSUMED_TIME_SLOTS,
  aggregateRawStock,
  formatClock,
  joinConsumedAt,
  nextUnitRow,
  pickerStock,
  productBaseUnit,
  snapToSlot,
  splitConsumedAt,
  type RawStockEntry,
} from './consumptionDetail.model';
import {
  deleteWarning,
  deriveDetailView,
  nowIst,
  shouldLoadCatalog,
  shouldResumeProductPick,
  showsCreateProduct,
  type DetailMode,
} from './consumptionDetail.view';
import { parlourConsumptionSlots } from './ParlourConsumptionDetail';
import { pharmacyConsumptionSlots } from './PharmacyConsumptionDetail';
import { useConsumptionDetailForm } from './useConsumptionDetailForm';

/**
 * One page of active RAW batches is enough to price every row in a 500-product picker for any
 * business this app is built for. A business past it gets an understated figure on the rows it
 * misses — never an overstated one, since the fold only ever adds — and the exact per-product total
 * behind the over-draw check is fetched separately regardless.
 */
const RAW_BATCH_PAGE_SIZE = 500;

interface RouteParams {
  consumptionId?: number;
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
 * The Consumption Detail route: resolves the module, fetches the record, hosts the form engine and
 * owns the modals.
 *
 * Two modes only — a consumption is immutable, so there is no edit and no `setMode('edit')`.
 */
export function ConsumptionDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const moduleKey = (selectedModule || '').toUpperCase();
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;

  const consumptionId = route?.params?.consumptionId;
  const mode: DetailMode = route?.params?.mode === 'add' ? 'add' : 'view';

  const [item, setItem] = useState<ConsumptionDto | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);

  const [sheet, setSheet] = useState<null | 'product' | 'unit' | 'time'>(null);
  /** Which unit row the rung picker is editing. Meaningless while `sheet !== 'unit'`. */
  const [unitRowIndex, setUnitRowIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The two halves of the "go make a product, then come back here" round trip.
  const [pendingCreate, setPendingCreate] = useState(false);
  const [awaitingProduct, setAwaitingProduct] = useState(false);

  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  /**
   * Every product's RAW shelf, from ONE page of the business's active batches.
   *
   * Feeds the picker's per-row stock figure and the form's "Across N active RAW batches" line.
   * Frozen `{}` as the initial value, and `setRawStock` is only ever called with a NEW object —
   * this is state, so its identity is stable between renders, which is what keeps it safe to read
   * during render.
   */
  const [rawStock, setRawStock] = useState<Record<number, RawStockEntry>>({});
  /**
   * Whether that fold has actually landed.
   *
   * ⚠️ Load-bearing, and NOT derivable from `rawStock` being empty. "No batches came back" and
   * "the request has not answered yet" produce the same `{}`, and reading the empty one as the
   * first would render EVERY picker row inert with "no raw stock" for as long as the fetch takes —
   * a picker where nothing can be tapped, on a shelf that is full. The same null-is-not-zero rule
   * `availableBaseQty` follows, spelled as a flag because the value it guards is a map.
   */
  const [rawStockLoaded, setRawStockLoaded] = useState(false);
  /** The chosen product's exact RAW total. Null until it answers — null is NOT zero. */
  const [availableBaseQty, setAvailableBaseQty] = useState<number | null>(null);

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
    if (consumptionId == null) {
      setLoadError('No consumption was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await activeModule.loadConsumption(consumptionId);
    if (result?.success) setItem(result.data as ConsumptionDto);
    else setLoadError(result?.error);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumptionId, moduleKey]);

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
   * `ProductDetail` is registered on the CONSUMPTIONS stack, so this is a push within the current
   * stack and not a jump to the Products tab. That is what keeps this screen mounted — and with it
   * every field the user has already filled in.
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
    showToast('Consumption recorded', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  const onDeleted = useCallback(() => {
    // Says the stock came BACK. A delete here is a reversal, and a bare "Deleted" hides the one
    // thing the user most needs to know about what just happened to their inventory.
    showToast('Consumption deleted · stock restocked', 'success');
    navigation?.goBack?.();
  }, [navigation, showToast]);

  /**
   * One page of the business's ACTIVE raw batches, folded into a per-product lookup.
   *
   * ONE request rather than one per catalog row: `loadProductOptions` fetches up to 500 products,
   * so a `getTotalStock` per row would fire up to 500 requests the moment the picker opens. The
   * exact figure for the ONE product the user actually picks is fetched separately below, and that
   * is the number validation refuses an over-draw against.
   *
   * Every dependency here is a primitive. `activeModule` is a fresh object on every render — it is
   * an object literal, not a memo — so putting it in this array would refetch forever.
   */
  useEffect(() => {
    if (mode !== 'add' || businessId == null) return;
    let alive = true;
    void activeModule
      .loadInventoryByBusiness(
        businessId,
        { inventoryType: 'RAW_INVENTORY', status: 'ACTIVE' },
        1,
        RAW_BATCH_PAGE_SIZE,
      )
      .then((res: { success: boolean; data?: unknown }) => {
        if (!alive || !res?.success) return;
        setRawStock(aggregateRawStock(res.data as BatchDto[]));
        setRawStockLoaded(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, businessId, moduleKey]);

  /**
   * The base unit every quantity label on this screen is written in.
   *
   * Two sources, because the two modes genuinely know it differently:
   *
   *   • ADD  — captured from the picker row at the moment a product is chosen. State rather than a
   *     lookup through the catalog, because the form engine needs it and the engine is declared
   *     BEFORE anything derived from `engine.form.itemId` can exist.
   *   • VIEW — read off the record itself. A saved consumption carries its own units, so the read
   *     screen needs no product fetch at all to label its headline figure.
   */
  const [pickedBaseUnit, setPickedBaseUnit] = useState('unit');
  const baseUnit = mode === 'add' ? pickedBaseUnit : recordQtyParts(item).unit;

  const engine = useConsumptionDetailForm({
    mode,
    item,
    moduleApi: activeModule,
    businessId,
    availableBaseQty,
    baseUnit,
    onSaved,
    onDeleted,
  });

  /** The chosen product's ladder, for the rung picker on each row and the Add-unit gate. */
  const selected = useMemo(
    () => catalog.find((p) => Number((p as { id?: number }).id) === engine.form.itemId),
    [catalog, engine.form.itemId],
  );
  const saleUnits: SaleUnit[] = useMemo(() => saleUnitsOf(selected), [selected]);

  /**
   * The exact RAW total for the chosen product, in base units.
   *
   * Reset to null BEFORE the request rather than left on the previous product's figure: an
   * over-draw check run against the wrong product's stock is worse than one skipped, because it
   * refuses a quantity the server would have accepted (or, the other way round, waves through one
   * it will not).
   */
  const itemId = engine.form.itemId;
  useEffect(() => {
    if (itemId == null || businessId == null) {
      setAvailableBaseQty(null);
      return;
    }
    let alive = true;
    setAvailableBaseQty(null);
    void activeModule
      .getTotalStock(itemId, businessId, 'RAW_INVENTORY')
      .then((res: { success: boolean; data?: unknown }) => {
        if (!alive || !res?.success) return;
        const total = Number(res.data);
        setAvailableBaseQty(Number.isFinite(total) ? total : null);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, businessId, moduleKey]);

  /** How many active RAW batches FEFO will draw from, for the helper line. Null when unknown. */
  const activeBatchCount = itemId == null ? null : (rawStock[itemId]?.activeBatches ?? null);

  /**
   * The picker rows: name · brand · type chip · price on the left, RAW stock on the right.
   *
   * `price` stays — the stock slot sits BESIDE it, not instead of it, exactly as the board draws
   * it. A product with nothing on the raw shelf is rendered INERT with "no raw stock" under its
   * zero, because tapping it could only ever produce a server refusal.
   *
   * ⚠️ Every one of those judgements is gated on `rawStockLoaded`. Until the fold lands the rows
   * carry NO stock slot and are fully tappable — an unanswered request must not read as an empty
   * shelf, or the picker opens with every row greyed out on a business that has stock.
   */
  const catalogRows: CatalogRow[] = useMemo(
    () =>
      catalog.map((p) => {
        const row = p as { id: number; name?: string; brand?: string; price?: number };
        const id = Number(row.id);
        const entry = rawStock[id];
        const empty = rawStockLoaded && (!entry || entry.baseQty <= 0);
        return {
          id,
          name: String(row.name ?? `Product #${row.id}`),
          price: Number(row.price ?? 0),
          subtitle: row.brand ? String(row.brand) : undefined,
          badge: catalogBadge(p),
          stock: rawStockLoaded ? pickerStock(entry, productBaseUnit(p)) : null,
          disabled: empty,
          // Replaces the breakdown rather than sitting beside it — "0 tubs" is true, useless, and
          // takes the place of the sentence that explains why the row cannot be tapped.
          disabledNote: empty ? 'no raw stock' : null,
          raw: p,
        };
      }),
    [catalog, rawStock, rawStockLoaded],
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

  const slots = moduleKey === 'PHARMACY' ? pharmacyConsumptionSlots() : parlourConsumptionSlots();

  return (
    <>
      <ConsumptionDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        ladder={saleUnits}
        baseUnit={baseUnit}
        availableBaseQty={availableBaseQty}
        activeBatchCount={activeBatchCount}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onPickProduct={() => setSheet('product')}
        onChangeUnitRows={(rows) => engine.setUnitRows(rows)}
        onAddUnitRow={() =>
          engine.setUnitRows([
            ...engine.form.unitRows,
            nextUnitRow(saleUnits, engine.form.unitRows),
          ])
        }
        onPickRowUnit={(index) => {
          setUnitRowIndex(index);
          setSheet('unit');
        }}
        onChangeConsumedDate={(ymd) => {
          // Seed the clock the moment a DAY is chosen rather than pre-filling the form on mount:
          // a timestamp that ticks while the form sits open goes stale and, worse, reads as
          // something the user picked. Floored onto a slot so it is never ahead of now.
          const current = splitConsumedAt(engine.form.consumedAt).time;
          const seeded = current || snapToSlot(splitConsumedAt(nowIst()).time);
          engine.setField('consumedAt', joinConsumedAt(ymd, seeded));
        }}
        onPickConsumedTime={() => setSheet('time')}
        onBack={() => navigation?.goBack?.()}
        onSave={mode === 'add' ? onSave : undefined}
        onDelete={mode === 'view' && item ? () => setConfirmDelete(true) : undefined}
      />

      {/* Single-select: a consumption is recorded against exactly one product, so tapping confirms. */}
      {sheet === 'product' ? (
        <CatalogPickerSheet
          visible
          singleSelect
          title="Select Product"
          subtitle={mode === 'add' ? 'New consumption' : ''}
          helper="Consumption deducts only from RAW inventory batches."
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
            const base = baseSaleUnit(saleUnitsOf(row.raw));
            // Captured HERE, from the row itself, so every label on the form has a unit before the
            // catalog lookup that would otherwise supply it has to be re-derived.
            setPickedBaseUnit(productBaseUnit(row.raw));
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
        The per-row rung picker. Gated on `sheet === 'unit'` rather than mounted with a `visible`
        prop, which is what keeps it from ever coexisting with the catalog picker — two Modals at
        once and the dismissed one's portal silently eats taps on react-native-web.
      */}
      {sheet === 'unit' ? (
        <OptionSheet
          visible
          title="Unit"
          options={saleUnits.map((u) => ({
            value: u.unit,
            label: u.unit,
            sub: u.perStock > 1 ? `×${u.perStock} ${baseUnit}` : 'base unit',
          }))}
          selected={engine.form.unitRows[unitRowIndex]?.unit ?? null}
          onSelect={(value) => {
            const rung = saleUnits.find((u) => u.unit === value);
            if (!rung) return;
            // `perStock` travels WITH the name. Writing the name alone would leave the row
            // converting through the previous rung's multiplier, which deducts the wrong amount
            // with nothing on screen to show it.
            engine.setUnitRows(
              engine.form.unitRows.map((r, i) =>
                i === unitRowIndex ? { ...r, unit: rung.unit, perStock: rung.perStock } : r,
              ),
            );
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'time' ? (
        <OptionSheet
          visible
          title="Consumed at"
          options={CONSUMED_TIME_SLOTS.map((t) => ({ value: t, label: formatClock(t) }))}
          selected={splitConsumedAt(engine.form.consumedAt).time || null}
          onSelect={(value) => {
            // Falls back to TODAY when no day has been picked yet, so choosing a time first is not
            // silently discarded by `joinConsumedAt`'s empty-date branch.
            const date = splitConsumedAt(engine.form.consumedAt).date || nowIst().slice(0, 10);
            engine.setField('consumedAt', joinConsumedAt(date, value));
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          visible
          title="Delete consumption?"
          message={deleteWarning({
            baseQty: recordQtyParts(item, baseUnit).value,
            baseUnit: recordQtyParts(item, baseUnit).unit,
            batchText: batchText(item),
          })}
          confirmLabel="Delete & restock"
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
