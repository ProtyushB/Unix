import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Shimmer ────────────────────────────────────────────────────────────────
// A single shared pulse drives every placeholder so the whole page breathes in
// step, matching the mockup's loading frame (`R1Uk6R`).

function usePulse() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return pulse;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  const styles = useThemedStyles(createStyles);
  const pulse = usePulse();

  const bar = (style: StyleProp<ViewStyle>, key?: string | number) => (
    <Animated.View key={key} style={[styles.bar, style, { opacity: pulse }]} />
  );

  return (
    <View style={styles.container}>
      {/* Stats row */}
      <View style={styles.row}>
        {[0, 1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.statCard, { opacity: pulse }]} />
        ))}
      </View>

      {/* Quick actions */}
      <View style={styles.block}>
        {bar(styles.sectionTitleBar)}
        <View style={styles.row}>
          {[0, 1, 2, 3].map((i) => (
            <Animated.View key={i} style={[styles.actionTile, { opacity: pulse }]} />
          ))}
        </View>
      </View>

      {/* Two list cards */}
      {[0, 1].map((section) => (
        <View key={section} style={styles.block}>
          {bar(styles.sectionTitleBar)}
          <View style={styles.listCard}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.listRow, i < 2 && styles.listRowDivided]}>
                <Animated.View style={[styles.chip, { opacity: pulse }]} />
                <View style={styles.listMid}>
                  {bar(styles.lineWide, 'a')}
                  {bar(styles.lineNarrow, 'b')}
                </View>
                <Animated.View style={[styles.pill, { opacity: pulse }]} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  const placeholder = theme.palette.surfaceElevated;

  return StyleSheet.create({
    container: {
      gap: 22,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    block: {
      gap: 12,
    },
    bar: {
      backgroundColor: placeholder,
      borderRadius: 6,
    },
    sectionTitleBar: {
      width: 140,
      height: 17,
    },
    statCard: {
      flex: 1,
      height: 76,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    actionTile: {
      flex: 1,
      height: 92,
      borderRadius: 12,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    listCard: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    listRowDivided: {
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    chip: {
      width: 58,
      height: 46,
      borderRadius: 12,
      backgroundColor: placeholder,
    },
    listMid: {
      flex: 1,
      gap: 6,
    },
    lineWide: {
      width: '70%',
      height: 13,
    },
    lineNarrow: {
      width: '45%',
      height: 11,
    },
    pill: {
      width: 68,
      height: 20,
      borderRadius: 999,
      backgroundColor: placeholder,
    },
  });
}
