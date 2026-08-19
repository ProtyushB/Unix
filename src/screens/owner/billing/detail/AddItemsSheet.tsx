import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { AdhocLineRow } from '../../shared/detail/parts/AdhocLineRow';
import { toPendingFiles } from '../../shared/detail/pendingFiles';
import { formatAmount } from './billDetail.model';
import {
  commitQuickDraft,
  doneLabel,
  emptyQuickDraft,
  newLineId,
  quickCountLabel,
  quickItemMeta,
  quickLineTotal,
  quickTotal,
  validateQuickDraft,
  type QuickBillItem,
  type QuickItemDraft,
} from './quickItem';

// Declared in `addItemsSheet.view.ts` so the tab and copy rules that turn on them can be tested
// without React Native. Re-exported here because that is where callers have always imported them.
import {
  emptyLine,
  helperLine,
  openingTab,
  type AddItemKind,
  type TopTab,
} from './addItemsSheet.view';

export type { AddItemKind };

/** One pickable row, already flattened by the screen. Same contract as `CatalogRow`. */
export interface AddItemRow {
  id: number;
  title: string;
  subtitle: string;
  amount: number;
  badge?: { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'muted' };
  /** "Will create an order" — see `quickAddRouting.destinationNote`. Catalog rows only. */
  note?: string;
  /** The record the caller needs back. Passed through untouched. */
  raw?: unknown;
}

export interface AddItemSource {
  rows: AddItemRow[];
  loading: boolean;
  error: string | null;
  /** Already on the bill. Shown ticked and inert. */
  alreadyAdded: number[];
  onRetry?: () => void;
}

export type AddItemSelection = Record<AddItemKind, AddItemRow[]>;

interface Props {
  visible: boolean;
  /** "Billing · Anjali Rao". Empty until a customer is chosen. */
  customerName: string;
  /**
   * Whether the bill has a customer at all — NOT whether it has a name. A walk-in can be a real
   * Person with a phone and no name, which is why this cannot be derived from `customerName`.
   */
  hasCustomer: boolean;
  sources: Record<AddItemKind, AddItemSource>;
  onAdd: (selection: AddItemSelection) => void;
  onClose: () => void;
  /** Fired when a tab is first shown, so the screen can fetch that list lazily. */
  onTabShown?: (kind: AddItemKind) => void;
  /** The ad-hoc lines already on the bill, so the sheet does not offer to re-add them. */
  quickItems?: QuickBillItem[];
  onAddQuickItems?: (items: QuickBillItem[]) => void;
}

/**
 * ⚠️ The middle tab used to be labelled "Quick Add" and was never that. Its sub-tabs are Products
 * and Services — it is the CATALOG picker, and the rows it adds are catalog lines that deduct
 * stock and may spawn an order. The genuinely ad-hoc source is the third tab, added beside it.
 * Anything keyed on the old label is the catalog path.
 *
 * No icons: three cells across a 358px sheet leave ~115px each, and an icon plus "Orders & Appts"
 * does not fit. Text alone, as drawn.
 */
const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: 'RECORDS', label: 'Orders & Appts' },
  { key: 'CATALOG', label: 'Catalog' },
  { key: 'QUICK', label: 'Quick Add' },
];

/** Quick Add is absent on purpose — it has no sub-tabs and no search. */
const SUB_TABS: Record<'RECORDS' | 'CATALOG', { key: AddItemKind; label: string }[]> = {
  RECORDS: [
    { key: 'ORDER', label: 'Orders' },
    { key: 'APPOINTMENT', label: 'Appointments' },
  ],
  CATALOG: [
    { key: 'PRODUCT', label: 'Products' },
    { key: 'SERVICE', label: 'Services' },
  ],
};

const KIND_ICON = {
  ORDER: ShoppingBag,
  APPOINTMENT: Calendar,
  PRODUCT: Package,
  SERVICE: Sparkles,
} as const;

const NOUN: Record<AddItemKind, string> = {
  ORDER: 'order',
  APPOINTMENT: 'appointment',
  PRODUCT: 'product',
  SERVICE: 'service',
};

const EMPTY_SELECTION: AddItemSelection = {
  ORDER: [],
  APPOINTMENT: [],
  PRODUCT: [],
  SERVICE: [],
};

/**
 * Put things on a bill: attach an existing order or appointment, or quick-add straight from the
 * catalog.
 *
 * Four lists behind two tab levels, exactly as the mockups draw them, and the split is not
 * cosmetic — the two halves do genuinely different things. Attaching an order LINKS a record that
 * already exists and already deducted its stock. Quick-adding from the catalog creates something
 * new: either a bare line on the bill, or a whole auto-generated order the server spawns on save.
 * Which of those two a catalog row takes is the row's own property, not a choice, so each row says
 * what it will do rather than offering a switch.
 *
 * Selections accumulate ACROSS tabs. The footer counts everything picked anywhere, so attaching an
 * order and quick-adding a product is one trip through the sheet rather than two.
 *
 * ⚠️ Modal insets and the never-two-Modals rule: see `OptionSheet`.
 */
export function AddItemsSheet({
  visible,
  customerName,
  hasCustomer,
  sources,
  onAdd,
  onClose,
  onTabShown,
  quickItems: seededQuickItems,
  onAddQuickItems,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  // Opens on Catalog when the bill has nobody on it — the records tab cannot fill without a
  // customer, so landing there would be a dead end before the seller has done anything.
  const opening = openingTab(hasCustomer);
  const [top, setTop] = useState<TopTab>(opening.top);
  const [kind, setKind] = useState<AddItemKind>(opening.kind);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<AddItemSelection>(EMPTY_SELECTION);

  /**
   * The Quick Add form, and the items committed from it during THIS trip through the sheet.
   *
   * `quickItems` holds only what was typed here — not the ad-hoc lines already on the bill. Handing
   * those back on Done would be harmless (the hook dedupes by `lineId`) but the footer would count
   * them, so "Done · 3 items" could appear after typing one.
   */
  const [draft, setDraft] = useState<QuickItemDraft>(emptyQuickDraft);
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [quickItems, setQuickItems] = useState<QuickBillItem[]>([]);

  const source = sources[kind];
  const added = useMemo(() => new Set(source.alreadyAdded), [source.alreadyAdded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source.rows;
    return source.rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q),
    );
  }, [source.rows, query]);

  const totals = useMemo(() => {
    const rows = Object.values(picked).flat();
    return { count: rows.length, amount: rows.reduce((sum, r) => sum + r.amount, 0) };
  }, [picked]);

  const goTo = (nextKind: AddItemKind) => {
    setKind(nextKind);
    setQuery('');
    onTabShown?.(nextKind);
  };

  const reset = () => {
    setPicked(EMPTY_SELECTION);
    setQuery('');
    setTop(opening.top);
    setKind(opening.kind);
    setDraft(emptyQuickDraft());
    setQuickErrors({});
    setQuickItems([]);
  };

  const setDraftField = (field: keyof QuickItemDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    // Clear only this field's error. Wiping all of them would un-mark a box the user has not
    // touched yet, and the two required fields are usually wrong together.
    setQuickErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const pickQuickPhoto = async () => {
    const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (response.didCancel) return;
    // One photo per line, so `toPendingFiles` is called for its normalisation, not its list — the
    // image fallbacks it applies are correct here because this picker only returns photos.
    const [file] = toPendingFiles(response.assets);
    if (file) setDraft((prev) => ({ ...prev, photo: file }));
  };

  /**
   * Commit the draft, or mark what is wrong with it.
   *
   * The button is never disabled — a disabled button cannot say WHICH field it is unhappy about,
   * and pressing it on an incomplete form is the only thing that surfaces the inline errors. It
   * dims while pristine and nothing more.
   */
  const addQuickItem = () => {
    const found = validateQuickDraft(draft);
    setQuickErrors(found);
    if (Object.keys(found).length) return;

    setQuickItems((prev) => [...prev, commitQuickDraft(draft, newLineId())]);
    // Clearing the form IS the confirmation that the item landed — the new row appears below and
    // the field the user is about to type into is empty again.
    setDraft(emptyQuickDraft());
  };

  const removeQuickItem = (lineId: string) => {
    setQuickItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const quickPristine =
    !draft.name && !draft.price && !draft.quantity && !draft.unit && !draft.photo;
  const dimAddItem = quickPristine && !Object.keys(quickErrors).length;

  /** How many ad-hoc lines the bill already carries, for the hint under an empty list. */
  const seededCount = seededQuickItems?.length ?? 0;

  /**
   * The sticky footer.
   *
   * On Quick Add it is always present — dimmed at zero, as drawn — because it is the only way off
   * that tab with the typed items intact. On the two list tabs it stays hidden until something is
   * picked, which is how the sheet has always behaved.
   *
   * The count and total span BOTH channels whenever both have something, so the button never
   * commits more than it says it will.
   */
  const footer = useMemo(() => {
    const count = totals.count + quickItems.length;
    const amount = totals.amount + quickTotal(quickItems);
    if (top === 'QUICK') {
      if (!totals.count) return { visible: true, disabled: !count, label: doneLabel(quickItems) };
      return {
        visible: true,
        disabled: false,
        label: `Done · ${count} item${count === 1 ? '' : 's'} · ${formatAmount(amount)}`,
      };
    }
    if (!count) return { visible: false, disabled: true, label: '' };
    return {
      visible: true,
      disabled: false,
      label: `Add ${count} selected · ${formatAmount(amount)}`,
    };
  }, [top, totals, quickItems]);

  const toggle = (row: AddItemRow) => {
    if (added.has(row.id)) return;
    setPicked((prev) => {
      const current = prev[kind];
      const exists = current.some((r) => r.id === row.id);
      return {
        ...prev,
        [kind]: exists ? current.filter((r) => r.id !== row.id) : [...current, row],
      };
    });
  };

  /**
   * Commit everything picked anywhere in the sheet, both channels.
   *
   * One button for both because selections accumulate across tabs: a user who attached an order,
   * then switched to Quick Add and typed an item, would otherwise lose the order by pressing Done.
   * The LABEL follows the active tab, as drawn, but the action is always "commit this trip".
   */
  const confirm = () => {
    if (totals.count) onAdd(picked);
    if (quickItems.length) onAddQuickItems?.(quickItems);
    reset();
    onClose();
  };

  const dismiss = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={dismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.appBar}>
          <Pressable
            style={styles.iconButton}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close add items"
          >
            <ChevronLeft size={20} color={theme.palette.onSurface} />
          </Pressable>
          <View style={styles.appBarCopy}>
            <Text style={styles.appBarTitle}>Add items</Text>
            <Text style={styles.appBarSubtitle}>
              {customerName ? `Billing · ${customerName}` : 'Billing'}
            </Text>
          </View>
        </View>

        <View style={styles.topTabs}>
          {TOP_TABS.map((tab) => {
            const active = top === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.topTab, active && styles.topTabOn]}
                onPress={() => {
                  setTop(tab.key);
                  // Quick Add fetches nothing, so it has no first sub-tab to land on.
                  if (tab.key !== 'QUICK') goTo(SUB_TABS[tab.key][0].key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Text style={active ? styles.topTabLabelOn : styles.topTabLabel}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {top === 'QUICK' ? (
          <QuickAddPanel
            draft={draft}
            errors={quickErrors}
            items={quickItems}
            seededCount={seededCount}
            dimAddItem={dimAddItem}
            styles={styles}
            theme={theme}
            bottomInset={110 + insets.bottom}
            onChange={setDraftField}
            onPickPhoto={pickQuickPhoto}
            onClearPhoto={() => setDraft((prev) => ({ ...prev, photo: null }))}
            onAddItem={addQuickItem}
            onRemoveItem={removeQuickItem}
          />
        ) : (
          <>
            <View style={styles.subTabs}>
              {SUB_TABS[top].map((tab) => {
                const active = kind === tab.key;
                const count = picked[tab.key].length;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.subTab, active && styles.subTabOn]}
                    onPress={() => goTo(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tab.label}
                  >
                    <Text style={active ? styles.subTabLabelOn : styles.subTabLabel}>
                      {count ? `${tab.label} · ${count}` : tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.searchWrap}>
              <Search size={15} color={theme.palette.muted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${NOUN[kind]}s…`}
                placeholderTextColor={theme.palette.muted}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.helper}>{helperLine(kind, hasCustomer)}</Text>

            {source.error ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{source.error}</Text>
                {source.onRetry ? (
                  <Pressable onPress={source.onRetry} accessibilityRole="button">
                    <Text style={styles.retry}>Try again</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {source.loading ? <ActivityIndicator style={styles.spinner} size="small" /> : null}

            <FlatList
              data={filtered}
              keyExtractor={(row) => `${kind}-${row.id}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
              renderItem={({ item: row }) => {
                const isAdded = added.has(row.id);
                const isPicked = picked[kind].some((r) => r.id === row.id);
                const on = isPicked || isAdded;
                const Icon = KIND_ICON[kind];
                return (
                  <Pressable
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => toggle(row)}
                    disabled={isAdded}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: isAdded }}
                    accessibilityLabel={row.title}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Check size={12} color={theme.colors.onAccent ?? '#FFFFFF'} /> : null}
                    </View>
                    <View style={styles.rowIcon}>
                      <Icon size={15} color={theme.palette.muted} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {row.title}
                      </Text>
                      <View style={styles.rowMeta}>
                        {row.subtitle ? <Text style={styles.rowSub}>{row.subtitle}</Text> : null}
                        {row.badge ? (
                          <Text style={[styles.badge, { color: toneColor(theme, row.badge.tone) }]}>
                            {row.badge.label}
                          </Text>
                        ) : null}
                        {isAdded ? <Text style={styles.rowSub}>Already on this bill</Text> : null}
                      </View>
                      {row.note ? <Text style={styles.rowNote}>{row.note}</Text> : null}
                    </View>
                    <Text style={styles.rowPrice}>{formatAmount(row.amount)}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                source.loading ? null : (
                  <Text style={styles.empty}>
                    {query ? `No ${NOUN[kind]} matches “${query}”.` : emptyLine(kind, customerName, hasCustomer)}
                  </Text>
                )
              }
            />
          </>
        )}

        {footer.visible ? (
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable
              style={[styles.addButton, footer.disabled && styles.addButtonDim]}
              onPress={footer.disabled ? undefined : confirm}
              disabled={footer.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: footer.disabled }}
              accessibilityLabel={footer.label}
            >
              {top === 'QUICK' ? (
                <Check size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
              ) : (
                <Plus size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
              )}
              <Text style={styles.addButtonText}>{footer.label}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

type Styles = ReturnType<typeof createStyles>;

/**
 * The Quick Add tab: type a product that is not in the catalog and bill it on this bill only.
 *
 * Its own component purely for length — every piece of state it touches is owned by the sheet, so
 * it stays a pure render. It scrolls with the form rather than putting the list in a `FlatList`:
 * the list is bounded by how many items a person types in one sitting, and a nested scroller
 * inside the sheet's own would fight it.
 */
function QuickAddPanel({
  draft,
  errors,
  items,
  seededCount,
  dimAddItem,
  styles,
  theme,
  bottomInset,
  onChange,
  onPickPhoto,
  onClearPhoto,
  onAddItem,
  onRemoveItem,
}: {
  draft: QuickItemDraft;
  errors: Record<string, string>;
  items: QuickBillItem[];
  seededCount: number;
  dimAddItem: boolean;
  styles: Styles;
  theme: AppTheme;
  bottomInset: number;
  onChange: (field: keyof QuickItemDraft, value: string) => void;
  onPickPhoto: () => void;
  onClearPhoto: () => void;
  onAddItem: () => void;
  onRemoveItem: (lineId: string) => void;
}) {
  const field = (key: 'name' | 'price' | 'quantity' | 'unit') => [
    styles.quickInput,
    errors[key] ? styles.quickInputError : null,
  ];

  return (
    <ScrollView
      style={styles.quickScroll}
      contentContainerStyle={[styles.quickContent, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.quickIntro}>
        <Text style={styles.quickIntroTitle}>Quick add a product</Text>
        <Text style={styles.quickIntroBody}>
          Not in your catalog? Type it here — billed on this bill only, no product is created.
        </Text>
      </View>

      <View style={styles.quickCard}>
        <View style={styles.quickField}>
          <Text style={styles.quickLabel}>Product Name *</Text>
          <TextInput
            style={field('name')}
            value={draft.name}
            onChangeText={(v) => onChange('name', v)}
            placeholder="e.g. Imported Clay Mask"
            placeholderTextColor={theme.palette.muted}
            accessibilityLabel="Product name"
          />
          {errors.name ? <Text style={styles.quickError}>{errors.name}</Text> : null}
        </View>

        <View style={styles.quickTrio}>
          <View style={styles.quickTrioPrice}>
            <Text style={styles.quickLabel}>Price *</Text>
            <TextInput
              style={field('price')}
              value={draft.price}
              onChangeText={(v) => onChange('price', v.replace(/[^0-9.]/g, ''))}
              placeholder="₹ 0.00"
              placeholderTextColor={theme.palette.muted}
              keyboardType="decimal-pad"
              accessibilityLabel="Price"
            />
            {errors.price ? <Text style={styles.quickError}>{errors.price}</Text> : null}
          </View>

          <View style={styles.quickTrioQty}>
            <Text style={styles.quickLabel}>Qty</Text>
            <TextInput
              style={field('quantity')}
              value={draft.quantity}
              onChangeText={(v) => onChange('quantity', v.replace(/[^0-9]/g, ''))}
              placeholder="1"
              placeholderTextColor={theme.palette.muted}
              keyboardType="number-pad"
              accessibilityLabel="Quantity"
            />
          </View>

          <View style={styles.quickTrioUnit}>
            <Text style={styles.quickLabel}>Unit (optional)</Text>
            <TextInput
              style={field('unit')}
              value={draft.unit}
              onChangeText={(v) => onChange('unit', v)}
              placeholder="e.g. jar"
              placeholderTextColor={theme.palette.muted}
              autoCapitalize="none"
              accessibilityLabel="Unit"
            />
          </View>
        </View>
        {errors.quantity ? <Text style={styles.quickError}>{errors.quantity}</Text> : null}

        <View style={styles.quickPhotoRow}>
          {/*
            The ✕ is a SIBLING of the tile, not a child of it, even though it is drawn on top.
            Nesting one Pressable inside another renders a <button> inside a <button> on
            react-native-web — invalid HTML, a React hydration warning, and a hit area whose owner
            depends on which element wins the event. The wrapper is the positioning context.
          */}
          <View style={styles.quickPhotoTileWrap}>
            <Pressable
              style={[styles.quickPhotoTile, draft.photo && styles.quickPhotoTileFilled]}
              onPress={onPickPhoto}
              accessibilityRole="button"
              accessibilityLabel={draft.photo ? 'Change photo' : 'Add photo'}
            >
              {draft.photo ? (
                <Image source={{ uri: draft.photo.uri }} style={styles.quickPhotoImage} />
              ) : (
                <Camera size={18} color={theme.palette.muted} />
              )}
            </Pressable>
            {draft.photo ? (
              <Pressable
                style={styles.quickPhotoRemove}
                onPress={onClearPhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <X size={11} color={theme.colors.onAccent ?? '#FFFFFF'} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.quickPhotoCopy}>
            <Text style={draft.photo ? styles.quickPhotoNameOn : styles.quickPhotoName}>
              {draft.photo ? draft.photo.name : 'Add photo'}
            </Text>
            <Text style={styles.quickPhotoHint}>
              {draft.photo
                ? "Attached · uploads to this bill's folder on save"
                : 'Optional · stored with this bill, not the catalog'}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.quickAddButton, dimAddItem && styles.addButtonDim]}
          onPress={onAddItem}
          accessibilityRole="button"
          accessibilityLabel="Add item"
        >
          <Plus size={16} color={theme.colors.onAccent ?? '#FFFFFF'} />
          <Text style={styles.addButtonText}>Add item</Text>
        </Pressable>
      </View>

      <View style={styles.quickListHeader}>
        <Text style={styles.quickListTitle}>QUICK ITEMS</Text>
        <Text style={styles.quickListCount}>{quickCountLabel(items)}</Text>
      </View>

      {items.length ? (
        <View style={styles.quickList}>
          {items.map((item) => (
            <AdhocLineRow
              key={item.lineId}
              item={item}
              meta={quickItemMeta(item, 'picker')}
              amount={formatAmount(quickLineTotal(item))}
              editable
              onRemove={() => onRemoveItem(item.lineId)}
            />
          ))}
          <View style={styles.quickNote}>
            <Text style={styles.quickNoteText}>
              These lines are billed on this bill only — no order and no catalog product is created.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.quickEmpty}>
          <Package size={22} color={theme.palette.muted} />
          <Text style={styles.quickEmptyTitle}>
            {seededCount ? 'No quick items added here yet' : 'No quick items yet'}
          </Text>
          <Text style={styles.quickEmptyBody}>
            Fill the form above and press Add item — it&rsquo;s billed directly on this bill.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function toneColor(theme: AppTheme, tone: NonNullable<AddItemRow['badge']>['tone']): string {
  switch (tone) {
    case 'success':
      return theme.palette.success;
    case 'warning':
      return theme.palette.warning;
    case 'error':
      return theme.palette.error;
    case 'info':
      return theme.palette.info;
    default:
      return theme.palette.muted;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    appBarCopy: { flex: 1, gap: 2 },
    appBarTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 12, color: theme.palette.muted },

    topTabs: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 13,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    topTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // No gap and no icon: three cells share ~115px each, and "Orders & Appts" needs all of it.
      height: 38,
      borderRadius: 10,
      paddingHorizontal: 4,
    },
    topTabOn: { backgroundColor: theme.colors.primary },
    topTabLabel: { fontSize: 12, fontWeight: '600', color: theme.palette.muted },
    topTabLabelOn: { fontSize: 12, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },

    subTabs: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
    subTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    subTabOn: { borderColor: theme.colors.border, backgroundColor: theme.colors.softBg },
    subTabLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    subTabLabelOn: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    searchInput: { flex: 1, color: theme.palette.onSurface, fontSize: 14 },
    helper: { marginHorizontal: 16, marginTop: 10, fontSize: 11.5, color: theme.palette.muted },

    errorBlock: { marginHorizontal: 16, marginTop: 10, gap: 4 },
    errorText: { fontSize: 12.5, color: theme.palette.error },
    retry: { fontSize: 12.5, fontWeight: '600', color: theme.colors.primary },
    spinner: { marginTop: 16 },

    list: { padding: 16, gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rowOn: { borderColor: theme.colors.border, backgroundColor: theme.colors.softBg },
    check: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    checkOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
    },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 13.5, fontWeight: '600', color: theme.palette.onSurface },
    rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    rowSub: { fontSize: 11.5, color: theme.palette.muted },
    rowNote: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
    badge: { fontSize: 11, fontWeight: '600' },
    rowPrice: { fontSize: 13.5, fontWeight: '700', color: theme.colors.primary },
    empty: { fontSize: 13, color: theme.palette.muted, textAlign: 'center', marginTop: 32 },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: theme.palette.background,
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },
    addButtonText: { fontSize: 14, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
    /** Drawn, not derived: the mockup dims a not-yet-actionable accent button to 45%. */
    addButtonDim: { opacity: 0.45 },

    // ── Quick Add ────────────────────────────────────────────────────────────
    quickScroll: { flex: 1 },
    quickContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

    quickIntro: { gap: 3 },
    quickIntroTitle: { fontSize: 14, fontWeight: '700', color: theme.palette.onBackground },
    quickIntroBody: { fontSize: 11.5, lineHeight: 17, color: theme.palette.muted },

    quickCard: {
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    quickField: { gap: 6 },
    quickLabel: { fontSize: 12, fontWeight: '600', color: theme.palette.muted },
    quickInput: {
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      fontSize: 13.5,
      color: theme.palette.onSurface,
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    quickInputError: { borderColor: theme.palette.error },
    quickError: { fontSize: 11, fontWeight: '500', color: theme.palette.error },

    quickTrio: { flexDirection: 'row', gap: 8 },
    quickTrioPrice: { flex: 1, gap: 6 },
    quickTrioQty: { width: 68, gap: 6 },
    quickTrioUnit: { width: 104, gap: 6 },

    quickPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    /** Positioning context for the ✕, which overlays the tile without nesting inside it. */
    quickPhotoTileWrap: { width: 64, height: 64 },
    quickPhotoTile: {
      width: 64,
      height: 64,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    // With a photo in it the tile IS the border; keeping the stroke double-outlines the image.
    quickPhotoTileFilled: { borderWidth: 0 },
    quickPhotoImage: { width: '100%', height: '100%' },
    quickPhotoRemove: {
      position: 'absolute',
      top: 3,
      right: 3,
      width: 20,
      height: 20,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.overlay ?? '#0B0F1ACC',
    },
    quickPhotoCopy: { flex: 1, gap: 3 },
    quickPhotoName: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    quickPhotoNameOn: { fontSize: 12.5, fontWeight: '600', color: theme.palette.onSurface },
    quickPhotoHint: { fontSize: 11, lineHeight: 15, color: theme.palette.muted },

    quickAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },

    quickListHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 2,
      paddingTop: 2,
    },
    quickListTitle: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: theme.palette.muted,
    },
    quickListCount: { fontSize: 11.5, fontWeight: '600', color: theme.palette.onSurface },

    quickList: { gap: 8 },
    quickNote: {
      padding: 9,
      borderRadius: 8,
      backgroundColor: theme.palette.surfaceElevated,
    },
    quickNoteText: {
      fontSize: 11,
      lineHeight: 15,
      fontStyle: 'italic',
      color: theme.palette.muted,
    },

    quickEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 26,
      paddingHorizontal: 18,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    quickEmptyTitle: { fontSize: 13.5, fontWeight: '700', color: theme.palette.onSurface },
    quickEmptyBody: {
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: 'center',
      color: theme.palette.muted,
    },
  });
}
