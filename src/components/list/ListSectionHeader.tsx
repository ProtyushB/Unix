import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListSectionHeaderProps {
  title:   string;
  /** Small trailing label, e.g. count or totals. */
  count?:  string | number;
}

// ─── Component ───────────────────────────────────────────────────────────────
// Pattern D: Sticky section header for SectionList. Small uppercase title,
// background-color-matched so it looks natural sticking to the top.

export function ListSectionHeader({ title, count }: ListSectionHeaderProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   8,
      backgroundColor:   theme.palette.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.palette.divider,
    },
    title: {
      fontSize:      11,
      fontWeight:    '700',
      letterSpacing: 1.1,
      color:         theme.palette.muted,
      textTransform: 'uppercase',
    },
    count: {
      fontSize:   12,
      fontWeight: '600',
      color:      theme.palette.muted,
    },
  });
}
