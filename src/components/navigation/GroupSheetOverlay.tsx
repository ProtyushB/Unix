import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useBlurTargets } from '../common/BlurTargetContext';
import type { AppTheme } from '../../theme/theme.types';
import { NAV_GROUPS } from '../../navigation/navGroups';
import {
  useGroupSheetState,
  closeGroupSheet,
} from '../../navigation/groupSheetState';

// ─── Component ───────────────────────────────────────────────────────────────
// Rendered as a sibling of <Tab.Navigator> at the OwnerTabNavigator root so it
// lives in the same native window as the rest of the UI. That avoids the
// Modal-window attach delay on Android (50–150 ms where the first touch is
// swallowed after the sheet appears).
//
// Dark themes: glass treatment — BlurView backdrop + surface tint + diagonal
// accent sheen. Since the sheet overlays the dashboard (charts, cards), the
// blur picks up rich content behind. Light themes: flat elevated surface.

export function GroupSheetOverlay() {
  const { openGroupId, activeTabName, navigate } = useGroupSheetState();
  const theme = useTheme();
  const { colors, palette } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { contentTarget } = useBlurTargets();
  const isDark = theme.mode === 'dark';

  const slideAnim   = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [renderedGroupId, setRenderedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (openGroupId) {
      setRenderedGroupId(openGroupId);
      slideAnim.setValue(400);
      overlayAnim.setValue(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue:         0,
            duration:        220,
            easing:          Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(overlayAnim, {
            toValue:         1,
            duration:        180,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (renderedGroupId !== null) {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRenderedGroupId(null);
      });
    }
  }, [openGroupId]);

  const group = renderedGroupId
    ? NAV_GROUPS.find(g => g.id === renderedGroupId)
    : null;
  if (!group) return null;

  const isActive = openGroupId !== null;

  const handleItemPress = (tab: string) => {
    navigate?.(tab);
    closeGroupSheet();
  };

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={isActive ? 'box-none' : 'none'}
    >
      <Animated.View style={[styles.backdrop, { opacity: overlayAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => closeGroupSheet()}
        />
      </Animated.View>

      <Animated.View
        style={[
          isDark ? styles.sheetGlass : styles.sheetFlat,
          {
            paddingBottom: insets.bottom + 12,
            transform:     [{ translateY: slideAnim }],
          },
        ]}
      >
        {isDark && (
          <>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurTarget={contentTarget ?? undefined}
              blurMethod="dimezisBlurView"
              intensity={50}
              tint="dark"
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(0, 0, 0, 0.20)' },
              ]}
            />
          </>
        )}

        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{group.label.toUpperCase()}</Text>
          <View style={styles.sheetDivider} />

          {group.items.map(item => {
            const ItemIcon     = item.icon;
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
                <View style={styles.sheetItemIcon}>
                  <ItemIcon
                    size={18}
                    color={isActiveItem ? colors.primary : palette.onSurface}
                  />
                </View>
                <Text
                  style={[
                    styles.sheetItemLabel,
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
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  const sheetBase = {
    position:              'absolute' as const,
    left:                  0,
    right:                 0,
    bottom:                0,
    borderTopLeftRadius:   20,
    borderTopRightRadius:  20,
    paddingTop:            8,
    paddingHorizontal:     16,
  };

  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.palette.overlay,
    },
    sheetFlat: {
      ...sheetBase,
      backgroundColor: theme.palette.surfaceElevated,
      ...theme.elevation.high,
    },
    sheetGlass: {
      ...sheetBase,
      backgroundColor: 'transparent',
      overflow:        'hidden',
      borderTopWidth:  1,
      borderColor:     theme.palette.divider + '80',
    },
    sheetContent: {
      zIndex: 1,
    },
    sheetHandle: {
      alignSelf:       'center',
      width:           40,
      height:          4,
      borderRadius:    2,
      backgroundColor: theme.palette.divider,
      marginBottom:    12,
    },
    sheetTitle: {
      fontSize:          10,
      fontWeight:        '700',
      letterSpacing:     1.2,
      color:             theme.palette.muted,
      paddingHorizontal: 4,
      paddingBottom:     8,
    },
    sheetDivider: {
      height:          1,
      backgroundColor: theme.palette.divider,
      marginBottom:    8,
    },
    sheetItem: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               12,
      paddingHorizontal: 12,
      paddingVertical:   12,
      borderRadius:      12,
      marginBottom:      2,
    },
    sheetItemActive: {
      backgroundColor: theme.colors.softBg,
      borderWidth:     1,
      borderColor:     theme.colors.border,
    },
    sheetItemPressed: {
      opacity: 0.7,
    },
    sheetItemIcon: {
      width:           32,
      height:          32,
      borderRadius:    10,
      backgroundColor: theme.palette.surface,
      alignItems:      'center',
      justifyContent:  'center',
    },
    sheetItemLabel: {
      flex:       1,
      fontSize:   15,
      fontWeight: '600',
      color:      theme.palette.onSurface,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical:   3,
      borderRadius:      8,
      backgroundColor:   theme.palette.surface,
    },
    badgeText: {
      fontSize:   11,
      fontWeight: '700',
      color:      theme.palette.muted,
    },
  });
}
