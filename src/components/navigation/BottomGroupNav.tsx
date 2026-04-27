import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useBlurTargets } from '../common/BlurTargetContext';
import type { AppTheme } from '../../theme/theme.types';
import { NAV_GROUPS, findGroupByTabName } from '../../navigation/navGroups';
import {
  openGroupSheet,
  setActiveTabName,
  setGroupSheetNavigator,
  useGroupSheetState,
} from '../../navigation/groupSheetState';

// ─── Component ───────────────────────────────────────────────────────────────
// Bar-only: the sheet is rendered by <GroupSheetOverlay /> at the navigator
// root so it lives in the same native window. That sidesteps the Modal
// attach delay on Android.
//
// Dark themes: glass treatment matching the Centrix web sidebar — BlurView
// against the page gradient, slate-translucent scrim at 40% alpha, slate
// border at 50% alpha. Light themes: flat opaque surface.

export function BottomGroupNav({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { openGroupId } = useGroupSheetState();
  const { gradientTarget } = useBlurTargets();
  const isDark = theme.mode === 'dark';

  const activeTabName = state.routes[state.index].name;
  const activeGroupId = findGroupByTabName(activeTabName)?.id;

  useEffect(() => {
    setActiveTabName(activeTabName);
  }, [activeTabName]);

  useEffect(() => {
    setGroupSheetNavigator((tab) => navigation.navigate(tab as never));
    return () => setGroupSheetNavigator(null);
  }, [navigation]);

  return (
    <View
      style={[
        isDark ? styles.barGlass : styles.barFlat,
        { paddingBottom: insets.bottom + 6 },
      ]}
    >
      {isDark && (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurTarget={gradientTarget ?? undefined}
            blurMethod="dimezisBlurView"
            intensity={30}
            tint="dark"
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: palette.surface + '66' },
            ]}
          />
        </>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.barContent, styles.barScrollContent]}
      >
        {NAV_GROUPS.map(group => {
          const GroupIcon  = group.groupIcon;
          const isActive   = activeGroupId === group.id;
          const isOpen     = openGroupId   === group.id;
          const tintActive = isActive || isOpen;
          const isSingle   = group.items.length === 1;

          return (
            <TouchableOpacity
              key={group.id}
              onPress={() =>
                isSingle
                  ? navigation.navigate(group.items[0].route.tab as never)
                  : openGroupSheet(group.id)
              }
              activeOpacity={0.7}
              style={[styles.barTab, tintActive && styles.barTabActive]}
              accessibilityLabel={group.label}
              accessibilityRole="tab"
            >
              <GroupIcon
                size={20}
                color={tintActive ? colors.primary : palette.muted}
              />
              <Text
                style={[
                  styles.barTabLabel,
                  { color: tintActive ? colors.primary : palette.muted },
                ]}
                numberOfLines={1}
              >
                {group.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    barFlat: {
      backgroundColor: theme.palette.surface,
      borderTopWidth:  1,
      borderTopColor:  theme.palette.divider,
      paddingTop:      6,
    },
    barGlass: {
      backgroundColor: 'transparent',
      overflow:        'hidden',
      borderTopWidth:  1,
      borderTopColor:  theme.palette.divider + '80',
      paddingTop:      6,
    },
    barContent: {
      paddingHorizontal: 12,
      gap:               8,
    },
    barScrollContent: {
      zIndex: 1,
    },
    barTab: {
      minWidth:          68,
      paddingHorizontal: 12,
      paddingVertical:   8,
      borderRadius:      12,
      alignItems:        'center',
      gap:               4,
    },
    barTabActive: {
      backgroundColor: theme.colors.softBg,
      borderWidth:     1,
      borderColor:     theme.colors.border,
    },
    barTabLabel: {
      fontSize:   11,
      fontWeight: '600',
    },
  });
}
