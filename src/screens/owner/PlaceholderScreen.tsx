import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Stand-in screen used for every navbar item that doesn't yet have a real
// implementation. Reads its title from the active route name so a single
// component covers all of them.

export function PlaceholderScreen() {
  const route  = useRoute();
  const styles = useThemedStyles(createStyles);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </ScreenWrapper>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    title: {
      fontSize:     28,
      fontWeight:   '700',
      color:        theme.palette.onBackground,
      marginTop:    16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color:    theme.palette.muted,
    },
  });
}
