import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Info,
  Package,
  Pencil,
  Receipt,
  ShieldAlert,
  Tags,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { ImageStage } from '../../shared/detail/parts/ImageStage';
import { SaleUnitsEditor } from './parts/SaleUnitsEditor';
import { SwitchRow } from '../../shared/detail/parts/SwitchRow';
import {
  formatPrice,
  formatSize,
  stockLine,
  toNumberOrNull,
  type ProductDetailItem,
  type ProductFormState,
} from './productDetail.model';
import {
  appBarTitle,
  isEditable,
  saveLabel,
  showsDelete,
  showsEditCta,
  showsInventorySection,
  showsSaleUnitLadder,
  type DetailMode,
} from './productDetail.view';

/**
 * Slots the module wrappers fill.
 *
 * One prop with named members rather than several props, so a fifth slot is a non-breaking change.
 * The web portal shipped with a single `extraSections` and its service sibling immediately needed
 * a second — that is the lesson being applied here rather than relearned.
 */
export interface ProductDetailSlots {
  /** Rows appended inside Product Information, after Description. */
  infoFields?: React.ReactNode;
  /** Whole cards, inserted after Selling Units & Pricing. */
  moduleSections?: React.ReactNode;
  /** Body of the Catalog Details card. Rendered only for a combo product. */
  comboSection?: React.ReactNode;
  /** Rows appended inside Inventory Tracking. */
  inventoryFields?: React.ReactNode;
}

export interface ProductDetailBaseProps {
  mode: DetailMode;
  item: ProductDetailItem;
  form: ProductFormState;
  errors: Record<string, string>;
  slots?: ProductDetailSlots;
  /** Business-level gate, not a mode question — an owner with the tab off has no stock at all. */
  inventoryTabEnabled: boolean;
  onFieldChange: (field: keyof ProductFormState, value: string | boolean) => void;
  onPackChange: (index: number, field: 'unit' | 'perStock' | 'price', value: string) => void;
  onAddPack: () => void;
  onRemovePack: (index: number) => void;
  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  /** Resolved image URIs — attached first, then freshly picked. See `useProductImages`. */
  imageUris?: string[];
  onAddImage?: () => void;
  onRemoveImage?: (index: number) => void;
  /** Platform feature gate. When off, the Normal/Combo segment is not rendered at all. */
  comboEnabled?: boolean;
  /** Called when someone taps Combo on a product that is not one. See the segment below. */
  onComboBlocked?: () => void;
  /** App-bar second line in edit mode: "Update this parlour product". */
  subtitle?: string;
}

/**
 * The product detail screen, in whichever mode it was asked for.
 *
 * One scroll of cards, no tabs, and every field rendered by a component that knows how to be both
 * read-only and editable — which is what collapses the six screens in the mockups into one.
 */
export function ProductDetailBase({
  mode,
  item,
  form,
  errors,
  slots,
  inventoryTabEnabled,
  onFieldChange,
  onPackChange,
  onAddPack,
  onRemovePack,
  onBack,
  onEdit,
  onSave,
  onDelete,
  saving = false,
  subtitle,
  imageUris = [],
  onAddImage,
  onRemoveImage,
  comboEnabled = false,
  onComboBlocked,
}: ProductDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);
  // The screen claims no bottom safe-area edge — the scroll should run under the home indicator —
  // so the floating button has to clear it itself.
  const showsFab = showsEditCta(mode) && !!onEdit;

  const size = formatSize(item.volume, item.volumeUnit);
  const quantity = item.availableQuantity as number | null | undefined;
  const stock = stockLine(quantity, item.stockUnit);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/*
        The mockups draw two different bars. Read mode is a centred title flanked by two 36×36
        boxed icon buttons; edit/add replaces the right-hand one with a filled Save and stacks a
        subtitle under the title. Both are 36-tall controls on a 10px gutter.
      */}
      <View style={styles.appBar}>
        <Pressable
          onPress={onBack}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={editable ? 'Cancel' : 'Back'}
        >
          {editable ? (
            <X size={18} color={theme.palette.onBackground} />
          ) : (
            <ChevronLeft size={20} color={theme.palette.onBackground} />
          )}
        </Pressable>

        <View style={[styles.appBarCopy, !editable && styles.appBarCopyCentered]}>
          <Text style={editable ? styles.appBarTitleForm : styles.appBarTitleRead}>
            {appBarTitle(mode)}
          </Text>
          {editable && subtitle ? <Text style={styles.appBarSubtitle}>{subtitle}</Text> : null}
        </View>

        {/* Read mode ends the bar with empty space the width of a button, so the title stays
            centred between the two gutters rather than drifting left. */}
        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Text style={styles.saveLabel}>{saveLabel(mode)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      {/*
        The screen claims no bottom safe-area edge, so the scroll runs under a translucent system
        nav bar — but the LAST element still has to clear it, or Delete sits under the nav bar and
        cannot be tapped. The inset always applies; the extra 78 is the floating button's own room.
      */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (showsFab ? 102 : 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/*
          Normal / Combo. Rendered only when the business has the combo feature, so an owner
          without it never learns combos exist.

          Tapping "Combo" on a plain product does NOT switch it — it explains where combos are
          built instead. The combo editor lives in the web portal, and `validateCombo` rejects a
          CUSTOM combo with fewer than two sub-products; letting someone flip the segment here
          would dead-end their save on an error about items this screen never offered. A product
          that already IS a combo shows as one and round-trips untouched.
        */}
        {comboEnabled && editable ? (
          <View style={styles.segment}>
            {[
              { label: 'Normal', value: 'NORMAL' },
              { label: 'Combo', value: 'COMBO' },
            ].map((option) => {
              const active = (form.productType || 'NORMAL') === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => (active ? undefined : onComboBlocked?.())}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* One component, both modes. Editing adds Add and Remove and changes nothing else, so a
            photo is picked at exactly the size the customer-facing screen will show it. */}
        <ImageStage
          uris={imageUris}
          editable={editable}
          onAdd={onAddImage}
          onRemove={onRemoveImage}
        />

        {!editable ? (
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{form.name || 'Untitled product'}</Text>
            {form.brand || size ? (
              <View style={styles.brandRow}>
                {form.brand ? <Text style={styles.brand}>{form.brand}</Text> : null}
                {form.brand && size ? <View style={styles.dot} /> : null}
                {size ? <Text style={styles.sizeText}>{size}</Text> : null}
              </View>
            ) : null}
            {/* Price and unit are two different sizes and colours in the mockup, baseline-aligned. */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(toNumberOrNull(form.price) ?? 0)}</Text>
              {form.stockUnit ? <Text style={styles.perUnit}>/ {form.stockUnit}</Text> : null}
            </View>
            <View style={styles.badges}>
              <Badge label={form.productType === 'COMBO' ? 'Combo' : 'Normal'} tone="neutral" />
              {inventoryTabEnabled ? (
                <Badge
                  label={form.trackInventory ? 'Tracked' : 'Untracked'}
                  tone={form.trackInventory ? 'info' : 'neutral'}
                />
              ) : null}
              {stock ? <Badge label={`In stock · ${stock}`} tone="success" /> : null}
            </View>
          </View>
        ) : null}

        {/*
          Read mode shows "Overview" — the description and nothing else. Name, brand and size are
          already the title block above, so repeating them as rows would say everything twice; the
          mockup's read screen has no Product Information card at all.
        */}
        {!editable ? (
          <DetailCard title="Overview" icon={Info}>
            {/* Manufacturer is the one Product Information field with nowhere else to go — name,
                brand and size are all in the title block above, so without this row it would be
                readable only by entering edit mode. Short fact first, prose last. */}
            <DetailField label="Manufacturer" value={form.manufacturer} editable={false} />
            <DetailField
              label="Description"
              value={form.description}
              editable={false}
              readLayout="block"
            />
            {slots?.infoFields}
          </DetailCard>
        ) : null}

        {editable ? (
          <DetailCard title="Product Information" icon={Info} gap={13}>
            <DetailField
              label="Product Name"
              value={form.name}
              editable
              required
              onChange={(v) => onFieldChange('name', v)}
              placeholder="e.g. Aloe Vera Face Wash"
              error={errors.name}
            />
            <DetailField
              label="Brand"
              value={form.brand}
              editable
              onChange={(v) => onFieldChange('brand', v)}
              placeholder="e.g. Lotus Professional"
            />
            <DetailField
              label="Manufacturer"
              value={form.manufacturer}
              editable
              onChange={(v) => onFieldChange('manufacturer', v)}
              placeholder="e.g. Lotus Herbals"
            />
            <DetailField
              label="Description"
              value={form.description}
              editable
              multiline
              maxLength={1000}
              onChange={(v) => onFieldChange('description', v)}
              placeholder="Short description…"
            />
            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <DetailField
                  label="Volume"
                  value={form.volume}
                  editable
                  keyboardType="number-pad"
                  onChange={(v) => onFieldChange('volume', v)}
                  placeholder="0"
                  error={errors.volume}
                />
              </View>
              <View style={styles.pairCol}>
                <DetailField
                  label="Unit"
                  value={form.volumeUnit}
                  editable
                  onChange={(v) => onFieldChange('volumeUnit', v)}
                  placeholder="ml"
                />
              </View>
            </View>
            {slots?.infoFields}
          </DetailCard>
        ) : null}

        {/* The set names this card differently per mode: a form builds selling units, a read
            screen summarises pricing. */}
        {showsSaleUnitLadder(form.productType) ? (
          <DetailCard
            title={editable ? 'Selling Units & Pricing' : 'Pricing & Units'}
            icon={Tags}
            gap={editable ? 13 : 12}
          >
            <SaleUnitsEditor
              editable={editable}
              stockUnit={form.stockUnit}
              price={form.price}
              packs={form.packs}
              saleUnits={item.saleUnits}
              basePriceLabel={formatPrice(toNumberOrNull(form.price) ?? 0)}
              errors={errors}
              onStockUnitChange={(v) => onFieldChange('stockUnit', v)}
              onPriceChange={(v) => onFieldChange('price', v)}
              onPackChange={onPackChange}
              onAddPack={onAddPack}
              onRemovePack={onRemovePack}
            />
          </DetailCard>
        ) : null}

        {slots?.comboSection ? (
          <DetailCard title="Catalog Details" icon={Package} gap={editable ? 13 : 12}>
            {slots.comboSection}
          </DetailCard>
        ) : null}

        {slots?.moduleSections}

        <DetailCard title="Safety & Packaging" icon={ShieldAlert} gap={editable ? 13 : 12}>
          {/* Single-line to fill in, stacked to read. A warning is short to write and long to
              scan, and the mockups draw it both ways for exactly that reason. */}
          <DetailField
            label="Safety Warning"
            value={form.safetyWarning}
            editable={editable}
            readLayout="block"
            onChange={(v) => onFieldChange('safetyWarning', v)}
            placeholder="e.g. For external use only"
          />
          <DetailField
            label={editable ? 'Packaging Type' : 'Packaging'}
            value={form.packagingType}
            editable={editable}
            onChange={(v) => onFieldChange('packagingType', v)}
            placeholder="e.g. Bottle / Tube / Jar"
          />
        </DetailCard>

        {/* Titled for what it is in each mode: a read-only summary versus a setting. */}
        {showsInventorySection(inventoryTabEnabled) ? (
          <DetailCard
            title={editable ? 'Inventory Tracking' : 'Inventory'}
            icon={Package}
            gap={editable ? 13 : 12}
          >
            <SwitchRow
              label={editable ? 'Track inventory' : 'Tracking'}
              explainer="When on, this product is stock-managed and its batches decide availability."
              value={form.trackInventory}
              editable={editable}
              onChange={(next) => onFieldChange('trackInventory', next)}
            />
            {/* Only shown when there is a number. A null quantity means nobody counted — printing
                "0" there would report an empty shelf for a product that is merely untracked. */}
            {!editable && stock ? (
              <DetailField label="In stock" value={stock} editable={false} />
            ) : null}
            {slots?.inventoryFields}
          </DetailCard>
        ) : null}

        <DetailCard title="Billing" icon={Receipt} gap={editable ? 13 : 12}>
          <SwitchRow
            label="Requires an order"
            explainer="When on, quick-adding this to a bill auto-generates an order behind it."
            value={form.isOrderRequired}
            editable={editable}
            onChange={(next) => onFieldChange('isOrderRequired', next)}
            readLabels={['Yes', 'No']}
            tintOn={false}
          />
        </DetailCard>

        {/* Not in add mode — there is nothing to delete before the first save. */}
        {showsDelete(mode) && onDelete ? (
          <Pressable
            onPress={onDelete}
            disabled={saving}
            style={styles.deleteButton}
            accessibilityRole="button"
          >
            <Trash2 size={16} color={theme.palette.error} />
            <Text style={styles.deleteLabel}>Delete product</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/*
        Outside the ScrollView, so it stays put while the page moves. Edit is the one thing you
        might want from anywhere on a long read — pinning it beats a button that is only reachable
        by scrolling past every section to the bottom.
      */}
      {showsFab ? (
        <Pressable
          onPress={onEdit}
          style={[styles.editFab, { bottom: insets.bottom + 20 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit product"
        >
          <Pencil size={24} color={theme.colors.onAccent ?? '#FFFFFF'} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 4,
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    // 36×36 boxed control, matching the mockup's back and overflow buttons.
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    iconButtonSpacer: { width: 36, height: 36 },
    appBarCopy: { flex: 1 },
    // Read mode centres the title between the two buttons; edit mode left-aligns it over its
    // subtitle, which is why this is conditional rather than baked into appBarCopy.
    appBarCopyCentered: { alignItems: 'center' },
    // Two different bars, not one bar with a variant. Reading a product, the product's own name is
    // the heading and the bar is just a breadcrumb; filling a form, the bar states which form it is
    // and is the largest text on screen until you scroll.
    appBarTitleRead: { fontSize: 13, fontWeight: '600', color: theme.palette.muted },
    appBarTitleForm: { fontSize: 17, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 11.5, color: theme.palette.muted },
    saveButton: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    // Dimmed rather than hidden while a save runs: the button vanishing mid-tap is disorienting,
    // and `disabled` already stops the second submit.
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
    content: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    titleBlock: { gap: 7 },
    name: { fontSize: 20, fontWeight: '700', color: theme.palette.onBackground },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    brand: { fontSize: 13, color: theme.palette.muted },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.palette.divider },
    sizeText: { fontSize: 13, color: theme.palette.muted },
    // Baseline-aligned so the small unit sits on the price's bottom edge, as drawn.
    priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    price: { fontSize: 22, fontWeight: '700', color: theme.colors.primary },
    perUnit: { fontSize: 12, fontWeight: '500', color: theme.palette.muted, paddingBottom: 2 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    pairRow: { flexDirection: 'row', gap: 10 },
    pairCol: { flex: 1 },
    segment: {
      flexDirection: 'row',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
      padding: 3,
      gap: 3,
    },
    segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    segmentItemActive: { backgroundColor: theme.colors.primary },
    segmentLabel: { fontSize: 13, fontWeight: '500', color: theme.palette.muted },
    segmentLabelActive: { fontWeight: '600', color: theme.colors.onAccent ?? '#FFFFFF' },
    editFab: {
      position: 'absolute',
      right: 16,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      // Accent-tinted rather than black: the button floats over cards that are themselves raised,
      // and a neutral shadow reads as grime against them.
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 41,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.error,
      backgroundColor: theme.palette.error + '0F',
    },
    // Barely-tinted and shorter than the Edit CTA: a destructive action should read as available
    // without competing with Save for the eye.
    deleteLabel: { fontSize: 14, fontWeight: '600', color: theme.palette.error },
  });
}
