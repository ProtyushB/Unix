import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useBlurTargets } from '../common/BlurTargetContext';
import type { AppTheme } from '../../theme/theme.types';
import { NAV_GROUPS, filterNavGroupsByTabs } from '../../navigation/navGroups';
import { useTabConfig } from '../../backend/tab-config';
import { useGroupSheetState, closeGroupSheet } from '../../navigation/groupSheetState';

// ─── Component ───────────────────────────────────────────────────────────────
// Rendered as a sibling of <Tab.Navigator> at the OwnerTabNavigator root so it
// lives in the same native window as the rest of the UI. That avoids the
// Modal-window attach delay on Android (50–150 ms where the first touch is
// swallowed after the sheet appears).
//
// Dark themes (experiment): backdrop blur — the entire screen behind the
// sheet gets blurred, the sheet itself is a solid elevated panel sitting
// on top. Inverts the previous pattern (sheet-as-glass).
// Light themes: flat elevated surface, no blur.

export function GroupSheetOverlay() {
  const { openGroupId, activeTabName, navigate } = useGroupSheetState();
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { contentTarget } = useBlurTargets();
  const isDark = theme.mode === 'dark';

  // Same filter the bar applies, so the sheet lists exactly the items whose tab
  // the group's bar entry is claiming to hold.
  const { tabs } = useTabConfig();
  const visibleGroups = useMemo(() => filterNavGroupsByTabs(NAV_GROUPS, tabs), [tabs]);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [renderedGroupId, setRenderedGroupIdState] = useState<string | null>(null);
  /**
   * Mirror of `renderedGroupId` for the open/close effect, which must NOT re-run when it changes.
   *
   * That effect only reads it to answer "is a sheet currently on screen?", so a first render with
   * no open group does not play an exit animation over nothing. As a dependency it would re-enter
   * the effect the moment the id is set on open, call slideAnim.setValue(400) again and replay the
   * entrance from the bottom.
   */
  const renderedGroupIdRef = useRef<string | null>(null);
  const setRenderedGroupId = useCallback((next: string | null) => {
    renderedGroupIdRef.current = next;
    setRenderedGroupIdState(next);
  }, []);

  useEffect(() => {
    if (openGroupId) {
      setRenderedGroupId(openGroupId);
      slideAnim.setValue(400);
      overlayAnim.setValue(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(overlayAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (renderedGroupIdRef.current !== null) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRenderedGroupId(null);
      });
    }
  }, [openGroupId, slideAnim, overlayAnim, setRenderedGroupId]);

  // The open group can vanish mid-session — a refetch or a business switch turns
  // off its last item. Hard-cut rather than animate out: the render below already
  // short-circuits to null, so an exit animation would play against nothing and
  // the bar tab would keep its "open" tint.
  useEffect(() => {
    if (!openGroupId) return;
    if (visibleGroups.some((g) => g.id === openGroupId)) return;
    closeGroupSheet();
    setRenderedGroupId(null);
    slideAnim.setValue(400);
    overlayAnim.setValue(0);
  }, [openGroupId, visibleGroups, slideAnim, overlayAnim, setRenderedGroupId]);

  const group = renderedGroupId ? visibleGroups.find((g) => g.id === renderedGroupId) : null;
  if (!group) return null;

  const isActive = openGroupId !== null;

  const handleItemPress = (tab: string) => {
    navigate?.(tab);
    closeGroupSheet();
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={isActive ? 'box-none' : 'none'}>
      <Animated.View
        style={[isDark ? styles.backdropDark : styles.backdrop, { opacity: overlayAnim }]}
      >
        {isDark && (
          <>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurTarget={contentTarget ?? undefined}
              blurMethod="dimezisBlurView"
              intensity={40}
              tint="dark"
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: palette.background + 'A6' }]}
            />
          </>
        )}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeGroupSheet()} />
      </Animated.View>

      <Animated.View
        style={[
          isDark ? styles.sheetSolidDark : styles.sheetFlat,
          {
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {isDark && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: palette.surfaceElevated + '80' }]}
          />
        )}
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{group.label.toUpperCase()}</Text>
          </View>

          <View style={styles.sheetItems}>
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              const isActiveItem = item.route.tab === activeTabName;

              return (
                <Pressable
                  key={item.label}
                  onPress={() => handleItemPress(item.route.tab)}
                  android_ripple={{ color: palette.divider }}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    isActiveItem && styles.sheetItemActive,
                    pressed && styles.sheetItemPressed,
                  ]}
                >
                  <View style={[styles.sheetItemIcon, isActiveItem && styles.sheetItemIconActive]}>
                    <ItemIcon size={19} color={isActiveItem ? colors.primary : palette.muted} />
                  </View>
                  <Text
                    style={[
                      styles.sheetItemLabel,
                      isActiveItem && styles.sheetItemLabelActive,
                      isActiveItem && { color: colors.primary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  const sheetBase = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 16,
  };

  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.palette.overlay,
    },
    backdropDark: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    sheetFlat: {
      ...sheetBase,
      backgroundColor: theme.palette.surfaceElevated,
      ...theme.elevation.high,
    },
    sheetSolidDark: {
      ...sheetBase,
      // Theme-aware midpoint: palette.surface as the base, with a 50%-alpha
      // palette.surfaceElevated overlay rendered as a child. The composite
      // sits between the two — bright enough to pop off the blurred backdrop,
      // dark enough not to feel jarring. overflow:hidden clips the overlay
      // to the rounded top corners.
      backgroundColor: theme.palette.surface,
      overflow: 'hidden',
      ...theme.elevation.high,
    },
    sheetGlass: {
      ...sheetBase,
      backgroundColor: 'transparent',
      overflow: 'hidden',
      borderTopWidth: 1,
      borderColor: theme.palette.divider + '80',
    },
    sheetContent: {
      zIndex: 1,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      marginBottom: 12,
    },
    sheetHeader: {
      paddingHorizontal: 4,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: theme.colors.primary,
    },
    sheetItems: {
      paddingTop: 10,
    },
    sheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      marginBottom: 2,
    },
    sheetItemActive: {
      backgroundColor: theme.colors.softBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sheetItemPressed: {
      opacity: 0.7,
    },
    sheetItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.palette.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetItemIconActive: {
      backgroundColor: theme.colors.softBg,
    },
    sheetItemLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: theme.palette.onBackground,
    },
    /** Weight only — the active tint is themed and stays at the call site. */
    sheetItemLabelActive: { fontWeight: '600' },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.palette.background,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.palette.muted,
    },
  });
}
