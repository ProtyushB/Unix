import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
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

export function GroupSheetOverlay() {
  const { openGroupId, activeTabName, navigate } = useGroupSheetState();
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const slideAnim   = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // renderedGroupId lags openGroupId by one animation cycle so the sheet stays
  // mounted while it slides out.
  const [renderedGroupId, setRenderedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (openGroupId) {
      setRenderedGroupId(openGroupId);
      slideAnim.setValue(400);
      overlayAnim.setValue(0);
      // Defer the slide-in by one frame so freshly-mounted sheet items are
      // already wired into the native touch tree before the sheet appears.
      // Without this, a very fast tap after opening can land during the
      // item-mount cycle and be dropped.
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
          styles.sheet,
          {
            paddingBottom: insets.bottom + 12,
            transform:     [{ translateY: slideAnim }],
          },
        ]}
      >
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
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.palette.overlay,
    },
    sheet: {
      position:              'absolute',
      left:                  0,
      right:                 0,
      bottom:                0,
      backgroundColor:       theme.palette.surfaceElevated,
      borderTopLeftRadius:   20,
      borderTopRightRadius:  20,
      paddingTop:            8,
      paddingHorizontal:     16,
      ...theme.elevation.high,
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
