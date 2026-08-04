import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../../theme/theme.types';
import { DetailField } from './DetailField';

interface ComboPlaceholderProps {
  comboType?: string | null;
  itemCount: number;
}

/**
 * What a combo product shows on mobile: what it is, how many sub-products it holds, and where to
 * change it.
 *
 * Deliberately read-only. The web portal's combo editor is a product search, a sub-product table
 * and per-item cost prices; a partial version here would let someone build a combo the server then
 * rejects — `validateCombo` wants at least two items for a CUSTOM combo and a cost price on every
 * item of a PRE_BUNDLED one — and the rejection would name sub-products the screen never showed.
 */
export function ComboPlaceholder({ comboType, itemCount }: ComboPlaceholderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.block}>
      <DetailField label="Combo type" value={comboType || ''} editable={false} />
      <DetailField
        label="Sub-products"
        value={itemCount === 1 ? '1 sub-product' : `${itemCount} sub-products`}
        editable={false}
      />
      <Text style={styles.note}>Combo contents are managed in the web portal.</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    block: { gap: 14 },
    note: { fontSize: 12, color: theme.palette.muted, lineHeight: 17 },
  });
}
