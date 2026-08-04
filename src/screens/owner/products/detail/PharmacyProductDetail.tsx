import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill, ShieldPlus, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { DetailCard } from './parts/DetailCard';
import { DetailField } from './parts/DetailField';
import type { ProductDetailSlots } from './ProductDetailBase';
import type { ProductFormState } from './productDetail.model';
import { setDispensing } from './productDetail.modules';
import { isEditable, type DetailMode } from './productDetail.view';

interface PharmacySlotsInput {
  mode: DetailMode;
  form: ProductFormState;
  errors: Record<string, string>;
  /** Replaces the whole extras bag, because dispensing writes two keys at once. */
  onExtrasChange: (next: Record<string, unknown>) => void;
}

/** Pharmacy's contribution: one card. Same rule as parlour — JSX only, decisions live in the config. */
export function pharmacySlots(input: PharmacySlotsInput): ProductDetailSlots {
  return { moduleSections: <PharmacySections {...input} /> };
}

function PharmacySections({ mode, form, errors, onExtrasChange }: PharmacySlotsInput) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const editable = isEditable(mode);
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const set = (field: string, value: unknown) => onExtrasChange({ ...form.extras, [field]: value });

  const rx = form.extras.isPrescriptionRequired === true;
  const dispensing = rx ? 'Prescription (Rx)' : 'Over the counter';

  return (
    <DetailCard title="Pharmaceutical Details" icon={Pill} gap={editable ? 13 : 12}>
      {/* Stacked to read: a generic name carries a parenthesised synonym and will not fit on the
          right of a label. */}
      <DetailField
        label="Generic Name"
        value={str(form.extras.genericName)}
        editable={editable}
        readLayout="block"
        onChange={(v) => set('genericName', v)}
        placeholder="e.g. Paracetamol"
      />
      {/*
        Two short fields that belong together — "Tablet, 500 mg" is one thought — so the form puts
        them on one line. Reading, they go back to being separate rows: a right-aligned value column
        only lines up if every row spans the card.
      */}
      {editable ? (
        <View style={styles.pairRow}>
          <View style={styles.pairCol}>
            <DetailField
              label="Dosage Form"
              value={str(form.extras.dosageForm)}
              editable
              onChange={(v) => set('dosageForm', v)}
              placeholder="e.g. Tablet"
            />
          </View>
          <View style={styles.pairCol}>
            <DetailField
              label="Strength"
              value={str(form.extras.strength)}
              editable
              onChange={(v) => set('strength', v)}
              placeholder="e.g. 500 mg"
            />
          </View>
        </View>
      ) : (
        <>
          <DetailField label="Dosage Form" value={str(form.extras.dosageForm)} editable={false} />
          <DetailField label="Strength" value={str(form.extras.strength)} editable={false} />
        </>
      )}
      <DetailField
        label="Route of Administration"
        value={str(form.extras.routeOfAdministration)}
        editable={editable}
        onChange={(v) => set('routeOfAdministration', v)}
        placeholder="e.g. Oral"
      />

      {/*
        Dispensing is ONE choice stored in TWO columns (isPrescriptionRequired, isOTC). Rendering it
        as a single segmented control and writing both keys together is what keeps them from
        contradicting each other — a product marked both Rx and OTC is a state no screen can act on.
      */}
      {editable ? (
        <View style={styles.field}>
          <Text style={styles.label}>Dispensing</Text>
          <View style={styles.segment}>
            {[
              { label: 'Prescription (Rx)', value: true, Icon: ShieldPlus },
              { label: 'Over the counter', value: false, Icon: ShoppingBag },
            ].map(({ label, value, Icon }) => {
              const active = rx === value;
              const tint = active ? (theme.colors.onAccent ?? '#FFFFFF') : theme.palette.muted;
              return (
                <Pressable
                  key={label}
                  onPress={() => onExtrasChange(setDispensing(form.extras, value))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                >
                  <Icon size={14} color={tint} />
                  <Text style={[styles.segmentLabel, { color: tint }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.dispensing ? <Text style={styles.error}>{errors.dispensing}</Text> : null}
        </View>
      ) : (
        // Accent-tinted when it is Rx: of the two, that is the one with a legal consequence.
        <DetailField
          label="Dispensing"
          value={dispensing}
          editable={false}
          tint={rx ? 'accent' : 'primary'}
        />
      )}

      <DetailField
        label="Storage Conditions"
        value={str(form.extras.storageConditions)}
        editable={editable}
        multiline
        readLayout="block"
        onChange={(v) => set('storageConditions', v)}
        placeholder="e.g. Store below 25°C, away from moisture"
      />
    </DetailCard>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    pairCol: { flex: 1 },
    field: { gap: 6 },
    // Matches DetailField's edit label, so Dispensing sits in the same column as the fields
    // above and below it despite not being a text input.
    label: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    segment: {
      flexDirection: 'row',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
      padding: 3,
      gap: 3,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      height: 33,
      gap: 6,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: theme.colors.primary },
    segmentLabel: { fontSize: 12.5, fontWeight: '600' },
    error: { fontSize: 12, color: theme.palette.error },
  });
}
