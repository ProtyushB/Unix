import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Droplet, Leaf, ShieldCheck } from 'lucide-react-native';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import { ToggleChip } from '../../shared/detail/parts/ToggleChip';
import type { ProductDetailSlots } from './ProductDetailBase';
import type { ProductFormState } from './productDetail.model';
import { isEditable, type DetailMode } from './productDetail.view';

interface ParlourSlotsInput {
  mode: DetailMode;
  form: ProductFormState;
  onExtraChange: (field: string, value: unknown) => void;
}

/**
 * Parlour's contribution to the product detail screen: two cards, nothing else.
 *
 * A "wrapper" here is genuinely only JSX. Everything with a decision in it — which fields exist,
 * what they default to, what validation they carry — lives in `productDetail.modules.ts`, because
 * that file is a `.ts` and therefore testable under this repo's jest config.
 */
export function parlourSlots({ mode, form, onExtraChange }: ParlourSlotsInput): ProductDetailSlots {
  return {
    moduleSections: <ParlourSections mode={mode} form={form} onExtraChange={onExtraChange} />,
  };
}

function ParlourSections({ mode, form, onExtraChange }: ParlourSlotsInput) {
  const styles = useThemedStyles(createStyles);
  const editable = isEditable(mode);
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

  return (
    <>
      <DetailCard title="Usage & Application" icon={Droplet} gap={editable ? 13 : 12}>
        <DetailField
          label="Skin Type"
          value={str(form.extras.skinType)}
          editable={editable}
          onChange={(v) => onExtraChange('skinType', v)}
          placeholder="e.g. All / Oily / Dry"
        />
        <DetailField
          label="Usage"
          value={str(form.extras.usage)}
          editable={editable}
          onChange={(v) => onExtraChange('usage', v)}
          placeholder="e.g. Daily, morning & night"
        />
        <DetailField
          label="Application Method"
          value={str(form.extras.applicationMethod)}
          editable={editable}
          readLayout="block"
          onChange={(v) => onExtraChange('applicationMethod', v)}
          placeholder="e.g. Massage onto damp skin"
        />
      </DetailCard>

      <DetailCard title="Ingredients & Composition" icon={Leaf} gap={editable ? 13 : 12}>
        <DetailField
          label="Ingredients"
          value={str(form.extras.ingredients)}
          editable={editable}
          multiline
          readLayout="block"
          onChange={(v) => onExtraChange('ingredients', v)}
          placeholder="List key ingredients…"
        />
        {/*
          Two independent claims, not a choice — a product can be both, either or neither.

          Tiles to set, rows to read. Reading, these are two more facts about the product and belong
          in the same label/value column as everything above them; a pair of coloured tiles would
          shout louder than the ingredients they annotate.
        */}
        {editable ? (
          <View style={styles.chips}>
            <ToggleChip
              label="Organic"
              icon={Leaf}
              active={form.extras.isOrganic === true}
              onToggle={() => onExtraChange('isOrganic', !(form.extras.isOrganic === true))}
            />
            <ToggleChip
              label="Cruelty-free"
              icon={ShieldCheck}
              active={form.extras.isCrueltyFree === true}
              onToggle={() => onExtraChange('isCrueltyFree', !(form.extras.isCrueltyFree === true))}
            />
          </View>
        ) : (
          <>
            <ClaimRow label="Organic" yes={form.extras.isOrganic === true} />
            <ClaimRow label="Cruelty-free" yes={form.extras.isCrueltyFree === true} />
          </>
        )}
      </DetailCard>
    </>
  );
}

/** Read-mode Organic / Cruelty-free: a plain answer, green only when it is a yes. */
function ClaimRow({ label, yes }: { label: string; yes: boolean }) {
  return (
    <DetailField
      label={label}
      value={yes ? 'Yes' : 'No'}
      editable={false}
      tint={yes ? 'success' : 'muted'}
    />
  );
}

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    chips: { flexDirection: 'row', gap: 10 },
  });
}
