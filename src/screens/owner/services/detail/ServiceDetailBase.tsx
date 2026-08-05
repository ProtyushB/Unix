import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Boxes,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Info,
  ListChecks,
  Pencil,
  Receipt,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { Badge } from '../../shared/detail/parts/Badge';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { MediaStrip } from '../../shared/detail/parts/MediaStrip';
import { SwitchRow } from '../../shared/detail/parts/SwitchRow';
import { RequiredProductsPicker } from './parts/RequiredProductsPicker';
import {
  formatDuration,
  formatPrice,
  toNumberOrNull,
  type ProductOption,
  type ServiceFormState,
} from './serviceDetail.model';
import {
  appBarTitle,
  isEditable,
  saveLabel,
  showsAvailabilitySegment,
  showsDelete,
  showsEditCta,
  type DetailMode,
} from './serviceDetail.view';

/**
 * Slots the module wrappers fill.
 *
 * Three members, one fewer than the product screen — and one of a shape products never needed.
 * `primaryField` is a GRID-CELL slot: the mockups put the module's own field inside the first card,
 * directly under the service name, where products only ever appended whole rows or whole cards.
 * The web portal hit this too and had to add a second slot to its service base after shipping the
 * product one with a single `extraSections`.
 */
export interface ServiceDetailSlots {
  /** The module's own field, inside Service Information immediately after the name. */
  primaryField?: React.ReactNode;
  /** Tools Required (parlour) / Equipment Required (pharmacy), after Service Includes. */
  moduleSections?: React.ReactNode;
  /**
   * The read-mode title-block badge — the expertise level or consultation type.
   *
   * Data, not JSX: the badge row owns its tinting, wrapping and order, and a wrapper handing back
   * a rendered pill would have to reimplement all three.
   */
  badgeLabel?: string;
}

export interface ServiceDetailBaseProps {
  mode: DetailMode;
  /**
   * No `item` prop, unlike the product screen. Everything drawn here comes from `form`, which
   * `toFormState` has already normalised — a second source of truth beside it is how a screen ends
   * up showing the saved value in one place and the edited one in another.
   */
  form: ServiceFormState;
  errors: Record<string, string>;
  slots?: ServiceDetailSlots;
  onFieldChange: (field: keyof ServiceFormState, value: string | boolean) => void;
  /**
   * Writes one key of `form.extras`. The base needs this for `serviceIncludes`, which both modules
   * carry — hoisted here rather than repeated in each wrapper, as the web portal does.
   */
  onExtraChange: (field: string, value: unknown) => void;
  onRequiredProductsChange: (next: number[]) => void;
  /** Products offered by the Required Products picker, and the state of fetching them. */
  productOptions?: ProductOption[];
  productOptionsLoading?: boolean;
  productOptionsError?: string | null;
  productOptionsTruncated?: boolean;
  onRetryProductOptions?: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  /** Resolved image URIs — attached first, then freshly picked. See `useServiceImages`. */
  imageUris?: string[];
  onAddImage?: () => void;
  onRemoveImage?: (index: number) => void;
  /** App-bar second line: "Update this parlour service". */
  subtitle?: string;
}

/**
 * The service detail screen, in whichever mode it was asked for.
 *
 * One scroll of cards, no tabs, and every field rendered by a component that knows how to be both
 * read-only and editable — which is what collapses the six screens in the mockups into one.
 */
export function ServiceDetailBase({
  mode,
  form,
  errors,
  slots,
  onFieldChange,
  onExtraChange,
  onRequiredProductsChange,
  productOptions = [],
  productOptionsLoading = false,
  productOptionsError = null,
  productOptionsTruncated = false,
  onRetryProductOptions,
  onBack,
  onEdit,
  onSave,
  onDelete,
  saving = false,
  subtitle,
  imageUris = [],
  onAddImage,
  onRemoveImage,
}: ServiceDetailBaseProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const editable = isEditable(mode);
  const showsFab = showsEditCta(mode) && !!onEdit;

  const price = formatPrice(toNumberOrNull(form.price) ?? 0);
  const duration = formatDuration(toNumberOrNull(form.duration));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
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

        {/* The form's Save carries a glyph and the full word, unlike the product screen's bare
            "Save" — the mockups draw a 131-wide button on every service form. */}
        {editable && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            accessibilityRole="button"
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
          >
            <Check size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
            <Text style={styles.saveLabel}>{saveLabel(mode)}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, showsFab && { paddingBottom: insets.bottom + 102 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MediaStrip
          uris={imageUris}
          editable={editable}
          onAdd={onAddImage}
          onRemove={onRemoveImage}
        />

        {!editable ? (
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{form.name || 'Untitled service'}</Text>
            {/* Price and duration read as one line: "₹15,000 · 180 min". */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              {duration ? <Text style={styles.perUnit}>· {duration}</Text> : null}
            </View>
            <View style={styles.badges}>
              {slots?.badgeLabel ? <Badge label={slots.badgeLabel} tone="accent" /> : null}
              <Badge
                label={form.availability ? 'Available' : 'Unavailable'}
                tone={form.availability ? 'success' : 'error'}
              />
              {form.isAppointmentRequired ? (
                <Badge label="Appointment required" tone="info" />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Read mode calls it Overview — the name and price are already the title block above, so
            repeating them as rows would say everything twice. */}
        <DetailCard
          title={editable ? 'Service Information' : 'Overview'}
          icon={Info}
          gap={editable ? 13 : 12}
        >
          {editable ? (
            <DetailField
              label="Service Name"
              value={form.name}
              editable
              required
              onChange={(v) => onFieldChange('name', v)}
              placeholder="e.g. Bridal Makeup Package"
              error={errors.name}
            />
          ) : null}
          {slots?.primaryField}
          <DetailField
            label="Description"
            value={form.description}
            editable={editable}
            multiline
            maxLength={1000}
            readLayout="block"
            onChange={(v) => onFieldChange('description', v)}
            placeholder="Short description…"
            error={errors.description}
          />
        </DetailCard>

        <DetailCard title="Pricing & Duration" icon={Wallet} gap={editable ? 13 : 12}>
          {editable ? (
            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <DetailField
                  label="Price (₹)"
                  value={form.price}
                  editable
                  required
                  keyboardType="decimal-pad"
                  onChange={(v) => onFieldChange('price', v)}
                  placeholder="0"
                  error={errors.price}
                />
              </View>
              <View style={styles.pairCol}>
                <DetailField
                  label="Duration (min)"
                  value={form.duration}
                  editable
                  keyboardType="number-pad"
                  onChange={(v) => onFieldChange('duration', v)}
                  placeholder="0"
                  error={errors.duration}
                />
              </View>
            </View>
          ) : (
            <>
              <DetailField label="Price" value={price} editable={false} />
              <DetailField label="Duration" value={duration} editable={false} />
              <DetailField
                label="Availability"
                value={form.availability ? 'Available' : 'Unavailable'}
                editable={false}
                tint={form.availability ? 'success' : 'error'}
              />
            </>
          )}
        </DetailCard>

        {/*
          Available / Unavailable, its own card between price and the products it consumes.
          Unlike the product screen's Normal/Combo segment, both halves are real: availability is
          a plain stored flag the owner sets, with no feature gate and nothing downstream to
          invalidate. Form-only — reading, it is a row inside Pricing & Duration above.
        */}
        {showsAvailabilitySegment(mode) ? (
          <DetailCard title="Availability" icon={CircleCheck} gap={11}>
            <View style={styles.segment}>
              {[
                { label: 'Available', value: true, Icon: CircleCheck },
                { label: 'Unavailable', value: false, Icon: CircleX },
              ].map(({ label, value, Icon }) => {
                const active = form.availability === value;
                const tint = active ? (theme.colors.onAccent ?? '#FFFFFF') : theme.palette.muted;
                return (
                  <Pressable
                    key={label}
                    onPress={() => onFieldChange('availability', value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                  >
                    <Icon size={15} color={tint} />
                    <Text style={[styles.segmentLabel, { color: tint }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Says what turning it off actually does. "Unavailable" alone reads like a delete. */}
            <Text style={styles.help}>
              Unavailable services stay saved but can&apos;t be booked or added to a bill.
            </Text>
          </DetailCard>
        ) : null}

        <DetailCard title="Required Products" icon={Boxes} gap={editable ? 13 : 12}>
          <RequiredProductsPicker
            editable={editable}
            value={form.requiredProductIds}
            options={productOptions}
            optionsLoading={productOptionsLoading}
            optionsError={productOptionsError}
            truncated={productOptionsTruncated}
            onRetryOptions={onRetryProductOptions}
            onChange={onRequiredProductsChange}
          />
        </DetailCard>

        {/* Both modules have this field, so it lives here rather than being repeated in each
            wrapper the way the web portal does. */}
        <DetailCard title="Service Includes" icon={ListChecks} gap={editable ? 13 : 12}>
          <DetailField
            label="Included Services"
            value={str(form.extras.serviceIncludes)}
            editable={editable}
            multiline
            readLayout="block"
            // The column is varchar(255) behind a 70-tall box; without this a long paste is a
            // Postgres 22001 with nothing on screen to hint at the limit.
            maxLength={255}
            onChange={(v) => onExtraChange('serviceIncludes', v)}
            placeholder="e.g. Airbrush Makeup, Hairstyling, Draping"
          />
        </DetailCard>

        {slots?.moduleSections}

        <DetailCard title="Billing" icon={Receipt} gap={editable ? 13 : 12}>
          <SwitchRow
            label="Requires an appointment"
            explainer="When on, quick-adding this service to a bill auto-generates an appointment behind it."
            value={form.isAppointmentRequired}
            editable={editable}
            onChange={(next) => onFieldChange('isAppointmentRequired', next)}
            readLabels={['Yes', 'No']}
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
            <Text style={styles.deleteLabel}>Delete service</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Outside the ScrollView, so it stays put while the page moves. */}
      {showsFab ? (
        <Pressable
          onPress={onEdit}
          style={[styles.editFab, { bottom: insets.bottom + 20 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit service"
        >
          <Pencil size={24} color={theme.colors.onAccent ?? '#FFFFFF'} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
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
    appBarCopyCentered: { alignItems: 'center' },
    appBarTitleRead: { fontSize: 13, fontWeight: '600', color: theme.palette.muted },
    appBarTitleForm: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    appBarSubtitle: { fontSize: 11.5, color: theme.palette.muted },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 12,
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    saveButtonBusy: { opacity: 0.6 },
    saveLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.onAccent ?? '#FFFFFF' },
    content: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    titleBlock: { gap: 7 },
    name: { fontSize: 20, fontWeight: '700', color: theme.palette.onBackground },
    priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    price: { fontSize: 22, fontWeight: '700', color: theme.colors.primary },
    perUnit: { fontSize: 13, fontWeight: '500', color: theme.palette.muted, paddingBottom: 3 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
    // Height pinned rather than derived from padding: the label's line box is taller than the
    // mockup's 16px, so 9+9 padding lands at 35.6 instead of 34.
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: theme.colors.primary },
    segmentLabel: { fontSize: 13, fontWeight: '600' },
    help: { fontSize: 11.5, color: theme.palette.muted, lineHeight: 16 },
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
    deleteLabel: { fontSize: 14, fontWeight: '600', color: theme.palette.error },
    editFab: {
      position: 'absolute',
      right: 16,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  });
}
