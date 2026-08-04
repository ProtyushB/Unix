import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { DetailField } from './DetailField';
import { formatLadderSummary, packLevelLabel, type PackLevel } from '../productDetail.model';

interface SaleUnitsEditorProps {
  editable: boolean;
  stockUnit: string;
  price: string;
  packs: PackLevel[];
  /** Read mode only — the stored ladder, so the summary matches what the server holds. */
  saleUnits?: unknown;
  /** Read mode only — the formatted base price, e.g. "₹349". */
  basePriceLabel?: string;
  errors: Record<string, string>;
  onStockUnitChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onPackChange: (index: number, field: keyof PackLevel, value: string) => void;
  onAddPack: () => void;
  onRemovePack: (index: number) => void;
}

/**
 * The pricing ladder.
 *
 * The stored shape is `[base, ...packs]` where the base always has `perStock: 1`, takes its name
 * from the product's stock unit and its price from the product price. The base is therefore not a
 * row the user adds or removes — it is the product itself, shown as a row — which is why editing
 * the stock unit or the price rewrites it rather than adding to the list.
 *
 * The base is two side-by-side columns, Stock unit and Price, as the mockup draws it. The web
 * version lays the pack levels out as a five-column grid; that does not survive 360px, so each pack
 * level becomes its own small card here.
 *
 * Every input is a `DetailField`, the same control the rest of the screen uses. `AppInput` is the
 * app's full-page form input — 50 tall, 16pt, with its own 16px bottom margin — and mixing the two
 * inside one card gives the card two different field sizes and a broken vertical rhythm.
 */
export function SaleUnitsEditor({
  editable,
  stockUnit,
  price,
  packs,
  saleUnits,
  basePriceLabel,
  errors,
  onStockUnitChange,
  onPriceChange,
  onPackChange,
  onAddPack,
  onRemovePack,
}: SaleUnitsEditorProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!editable) {
    // Order matters: the mockup reads Base unit → Base price → Pack levels, so the ladder's own
    // rows own the whole card rather than the screen interleaving a price row above them.
    const packSummary = formatLadderSummary(saleUnits);
    return (
      <View style={styles.readBlock}>
        <DetailField label="Base unit" value={stockUnit} editable={false} />
        <DetailField label="Base price" value={basePriceLabel} editable={false} />
        <DetailField
          label="Pack levels"
          value={packSummary}
          editable={false}
          tint={packSummary === 'None' ? 'muted' : 'primary'}
        />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow}>BASE UNIT</Text>
      <View style={styles.baseRow}>
        <View style={styles.col}>
          <DetailField
            label="Stock unit"
            value={stockUnit}
            editable
            onChange={onStockUnitChange}
            placeholder="piece"
            error={errors.stockUnit}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.col}>
          <DetailField
            label="Price (₹)"
            value={price}
            editable
            required
            onChange={onPriceChange}
            placeholder="0"
            keyboardType="decimal-pad"
            error={errors.price}
          />
        </View>
      </View>

      {packs.map((pack, index) => (
        <View key={`pack-${index}`} style={styles.packCard}>
          <View style={styles.packHeader}>
            <Text style={styles.packTitle}>{packLevelLabel(index)}</Text>
            <Pressable
              onPress={() => onRemovePack(index)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${packLevelLabel(index)}`}
            >
              <Trash2 size={16} color={theme.palette.error} />
            </Pressable>
          </View>
          <DetailField
            label="Unit"
            value={pack.unit}
            editable
            onChange={(v) => onPackChange(index, 'unit', v)}
            placeholder="Box"
            autoCapitalize="none"
          />
          <View style={styles.baseRow}>
            <View style={styles.col}>
              <DetailField
                label="Per stock"
                value={pack.perStock}
                editable
                onChange={(v) => onPackChange(index, 'perStock', v)}
                placeholder="10"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.col}>
              <DetailField
                label="Price (₹)"
                value={pack.price}
                editable
                onChange={(v) => onPackChange(index, 'price', v)}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {errors[`pack_${index}`] ? (
            <Text style={styles.packError}>{errors[`pack_${index}`]}</Text>
          ) : null}
        </View>
      ))}

      <Pressable onPress={onAddPack} style={styles.addButton} accessibilityRole="button">
        <Plus size={16} color={theme.palette.muted} />
        <Text style={styles.addLabel}>Add level (e.g. strip ×10, box ×100)</Text>
      </Pressable>

      <Text style={styles.helper}>
        The first row is your base (stock) unit — name it and set its price.
      </Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    readBlock: { gap: 12 },
    block: { gap: 13 },
    eyebrow: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: theme.palette.muted,
    },
    // Two equal columns, as drawn. Top-aligned rather than bottom-aligned so that a validation
    // message under one field pushes only its own column down.
    baseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    col: { flex: 1 },
    packCard: {
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    packHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    packTitle: { fontSize: 12, fontWeight: '700', color: theme.palette.muted },
    packError: { fontSize: 12, color: theme.palette.error },
    // Drawn as a filled input-coloured bar, not a dashed accent button: adding a pack level is an
    // optional extra, and it should not out-shout Save.
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    addLabel: { fontSize: 13, fontWeight: '500', color: theme.palette.muted },
    helper: { fontSize: 11, color: theme.palette.muted, lineHeight: 15.4 },
  });
}
