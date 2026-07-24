import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Accent tile + wordmark, top-left on every auth entry screen.

export function BrandMark() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <View style={styles.tile}>
        <Building2 size={22} color={colors.onAccent} />
      </View>
      <View>
        <Text style={styles.name}>UniX</Text>
        <Text style={[styles.tagline, { color: colors.secondary }]}>ENTERPRISE</Text>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    tile: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    name: {
      fontFamily: 'Inter-Bold',
      fontSize: 18,
      color: theme.palette.onBackground,
    },
    tagline: {
      fontFamily: 'Inter-Bold',
      fontSize: 9,
      letterSpacing: 1.6,
      marginTop: 1,
    },
  });
}

export default BrandMark;
