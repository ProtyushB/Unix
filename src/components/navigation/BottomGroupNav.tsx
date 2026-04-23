import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
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

export function BottomGroupNav({ state, navigation }: BottomTabBarProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { openGroupId } = useGroupSheetState();

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
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.barContent}
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
    bar: {
      backgroundColor: theme.palette.surface,
      borderTopWidth:  1,
      borderTopColor:  theme.palette.divider,
      paddingTop:      6,
    },
    barContent: {
      paddingHorizontal: 12,
      gap:               8,
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
