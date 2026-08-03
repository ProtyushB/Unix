import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useBlurTargets } from '../common/BlurTargetContext';
import type { AppTheme } from '../../theme/theme.types';
import { NAV_GROUPS, filterNavGroupsByTabs, findGroupByTabName } from '../../navigation/navGroups';
import { useTabGateRedirect } from '../../navigation/useTabGateRedirect';
import { useTabConfig } from '../../backend/tab-config';
import {
  openGroupSheet,
  setActiveTabName,
  setGroupSheetNavigator,
  useGroupSheetState,
} from '../../navigation/groupSheetState';

// ─── Initials ────────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────
// Bar-only: the sheet is rendered by <GroupSheetOverlay /> at the navigator
// root so it lives in the same native window. That sidesteps the Modal
// attach delay on Android.
//
// Dark themes: glass treatment matching the Centrix web sidebar — BlurView
// against the page gradient, slate-translucent scrim at 40% alpha, slate
// border at 50% alpha. Light themes: flat opaque surface.
//
// Per mockup `xmOUX`: the active tint sits on a borderless accent-soft pill
// behind the icon only (not the whole tab), and the Account tab renders a
// user-initials avatar instead of a group icon.
//
// Which groups appear is driven by the per-business tab config, exactly like the
// Centrix web sidebar: an item whose tabKey is off drops out of its group's
// sheet, and a group left with no items drops off the bar entirely.

export function BottomGroupNav({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { colors, palette, avatar } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { openGroupId } = useGroupSheetState();
  const { gradientTarget } = useBlurTargets();
  const isDark = theme.mode === 'dark';

  const { tabs } = useTabConfig();
  const visibleGroups = useMemo(() => filterNavGroupsByTabs(NAV_GROUPS, tabs), [tabs]);

  // Bounce off a screen whose tab just got switched off.
  useTabGateRedirect(state, navigation);

  const [accountName, setAccountName] = useState('User');
  useEffect(() => {
    (async () => {
      let raw = await AsyncStorage.getItem('session:userProfile');
      if (!raw) raw = await AsyncStorage.getItem('loggedInUser');
      if (!raw) return;
      try {
        const u = JSON.parse(raw);
        const full = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
        if (full) setAccountName(full);
      } catch {
        // ignore malformed cache
      }
    })();
  }, []);
  const accountColor = avatar.forName(accountName).bg;

  const activeTabName = state.routes[state.index].name;
  // Deliberately the UNFILTERED lookup: if the active group was just filtered
  // out, no tab highlights for the frame or two before the redirect lands.
  const activeGroupId = findGroupByTabName(activeTabName)?.id;

  useEffect(() => {
    setActiveTabName(activeTabName);
  }, [activeTabName]);

  useEffect(() => {
    setGroupSheetNavigator((tab) => navigation.navigate(tab as never));
    return () => setGroupSheetNavigator(null);
  }, [navigation]);

  return (
    <View style={[isDark ? styles.barGlass : styles.barFlat, { paddingBottom: insets.bottom + 6 }]}>
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
            style={[StyleSheet.absoluteFill, { backgroundColor: palette.surface + '66' }]}
          />
        </>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The horizontal insets matter in landscape: without them the first and last tab can slide
        // under a display cutout. Added to the content padding rather than the bar itself so the
        // bar's background still reaches the screen edges.
        contentContainerStyle={[
          styles.barContent,
          styles.barScrollContent,
          { paddingLeft: 14 + insets.left, paddingRight: 14 + insets.right },
        ]}
      >
        {visibleGroups.map((group) => {
          const GroupIcon = group.groupIcon;
          const isActive = activeGroupId === group.id;
          const isOpen = openGroupId === group.id;
          const tintActive = isActive || isOpen;
          // Counts VISIBLE items: a group filtered down to one surviving item
          // navigates straight there instead of opening a one-row sheet.
          const isSingle = group.items.length === 1;
          const isAccount = group.id === 'account';

          const tab = (
            <TouchableOpacity
              onPress={() =>
                isSingle
                  ? navigation.navigate(group.items[0].route.tab as never)
                  : openGroupSheet(group.id)
              }
              activeOpacity={0.7}
              style={styles.barTab}
              accessibilityLabel={group.label}
              accessibilityRole="tab"
            >
              {isAccount ? (
                // Avatar sits inside a wrapper matching the iconWrap footprint
                // (44×40) so its shorter height doesn't misalign the label. Uses
                // its own style — not iconWrap — to avoid iconWrap's overflow
                // clip swallowing the avatar.
                <View style={styles.avatarWrap}>
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: accountColor + '26',
                        borderColor: accountColor + '40',
                      },
                    ]}
                  >
                    <Text style={[styles.avatarInitials, { color: accountColor }]}>
                      {initialsOf(accountName)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.iconWrap, tintActive && styles.iconWrapActive]}>
                  <GroupIcon size={21} color={tintActive ? colors.primary : palette.muted} />
                </View>
              )}
              <Text
                style={[
                  styles.barTabLabel,
                  tintActive ? styles.barTabLabelActive : styles.barTabLabelIdle,
                  { color: tintActive ? colors.primary : palette.muted },
                ]}
                numberOfLines={1}
              >
                {group.label}
              </Text>
            </TouchableOpacity>
          );

          // The Account (profile) tab is set off from the functional groups by
          // a short vertical divider, per mockup `xmOUX`.
          return isAccount ? (
            <React.Fragment key={group.id}>
              <View style={styles.navDivider} />
              {tab}
            </React.Fragment>
          ) : (
            <React.Fragment key={group.id}>{tab}</React.Fragment>
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
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider,
      paddingTop: 6,
    },
    barGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider + '80',
      paddingTop: 6,
    },
    barContent: {
      paddingHorizontal: 14,
      gap: 2,
    },
    barScrollContent: {
      zIndex: 1,
    },
    barTab: {
      width: 76,
      paddingVertical: 8,
      paddingHorizontal: 2,
      alignItems: 'center',
      gap: 5,
    },
    navDivider: {
      width: 1,
      height: 32,
      alignSelf: 'center',
      marginHorizontal: 7,
      backgroundColor: theme.palette.divider,
    },
    iconWrap: {
      width: 44,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      // overflow:hidden forces an Android outline clip so the rounded corners
      // render even on tabs activated after mount (a bg transparent→color
      // transition otherwise leaves square corners on Android).
      overflow: 'hidden',
    },
    iconWrapActive: {
      backgroundColor: theme.colors.softBg,
    },
    avatarWrap: {
      width: 44,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    avatarInitials: {
      fontSize: 11,
      fontWeight: '600',
    },
    barTabLabel: {
      fontSize: 10,
      textAlign: 'center',
    },
    // Weight only. The tint itself is themed and stays at the call site alongside these.
    barTabLabelActive: { fontWeight: '600' },
    barTabLabelIdle: { fontWeight: '500' },
  });
}
