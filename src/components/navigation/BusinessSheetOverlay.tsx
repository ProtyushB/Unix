import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlurTargets } from '../common/BlurTargetContext';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { useAppContext } from '../../context/AppContext';
import {
  getBusinessTypeMap,
  type BusinessTypeMap,
  type Business,
} from '../../storage/session.storage';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import {
  useBusinessSheetState,
  closeBusinessSheet,
} from '../../navigation/businessSheetState';

// ─── Component ───────────────────────────────────────────────────────────────
// Mounted at the OwnerTabNavigator root. Triggered via openBusinessSheet()
// from any screen (currently the Dashboard header). Same inline-overlay
// pattern as GroupSheetOverlay — no RN Modal, so taps are responsive.

export function BusinessSheetOverlay() {
  const visible = useBusinessSheetState();
  const {
    selectedModule,
    selectedBusiness,
    setSelectedModule,
    setSelectedBusiness,
  } = useAppContext();
  const theme = useTheme();
  const { palette } = theme;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { contentTarget } = useBlurTargets();
  const isDark = theme.mode === 'dark';

  const slideAnim   = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [rendered, setRendered]               = useState(false);
  const [businessTypeMap, setBusinessTypeMap] = useState<BusinessTypeMap | null>(null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      (async () => {
        const map = await getBusinessTypeMap();
        setBusinessTypeMap(map);
      })();
      slideAnim.setValue(600);
      overlayAnim.setValue(0);
      // Defer the slide-in by one frame so Pressable rows are mounted and
      // in the native touch tree before the sheet is visible.
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue:         0,
            duration:        240,
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
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 600, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  const handleSelect = useCallback(
    (biz: Business, type: string) => {
      setSelectedModule(type);
      setSelectedBusiness((biz as any).businessName || biz.name);
      closeBusinessSheet();
    },
    [setSelectedModule, setSelectedBusiness],
  );

  if (!rendered) return null;

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Animated.View style={[styles.backdrop, { opacity: overlayAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => closeBusinessSheet()}
        />
      </Animated.View>

      <Animated.View
        style={[
          isDark ? styles.sheetGlass : styles.sheetFlat,
          {
            paddingBottom: insets.bottom + 16,
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
              intensity={60}
              tint="dark"
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: palette.surfaceElevated + '10' },
              ]}
            />
          </>
        )}
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select Business</Text>
          <Pressable
            onPress={() => closeBusinessSheet()}
            hitSlop={10}
            android_ripple={{ color: palette.divider, borderless: true }}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {businessTypeMap &&
            Object.keys(businessTypeMap).map(type => (
              <View key={type} style={styles.sheetSection}>
                <Text style={styles.sheetSubtitle}>{getBusinessTypeLabel(type)}</Text>
                {(businessTypeMap[type] || []).map((biz: Business) => {
                  const bizName  = (biz as any).businessName || biz.name;
                  const isActive =
                    selectedBusiness === bizName && selectedModule === type;

                  return (
                    <Pressable
                      key={biz.id}
                      onPress={() => handleSelect(biz, type)}
                      android_ripple={{ color: palette.divider }}
                      style={({ pressed }) => [
                        styles.sheetRow,
                        isActive && styles.sheetRowActive,
                        pressed  && styles.sheetRowPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sheetRowText,
                          isActive && styles.sheetRowTextActive,
                        ]}
                      >
                        {bizName}
                      </Text>
                      {isActive && <Text style={styles.activeCheckIcon}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
        </ScrollView>
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
    sheetFlat: {
      position:             'absolute',
      left:                 0,
      right:                0,
      bottom:               0,
      maxHeight:            '75%',
      backgroundColor:      theme.palette.surfaceElevated,
      borderTopLeftRadius:  20,
      borderTopRightRadius: 20,
      paddingTop:           8,
      ...theme.elevation.high,
    },
    sheetGlass: {
      position:             'absolute',
      left:                 0,
      right:                0,
      bottom:               0,
      maxHeight:            '75%',
      backgroundColor:      'transparent',
      borderTopLeftRadius:  20,
      borderTopRightRadius: 20,
      paddingTop:           8,
      overflow:             'hidden',
      borderTopWidth:       1,
      borderColor:          theme.palette.divider + '80',
    },
    sheetHandle: {
      alignSelf:       'center',
      width:           40,
      height:          4,
      borderRadius:    2,
      backgroundColor: theme.palette.divider,
      marginTop:       4,
      marginBottom:    8,
    },
    sheetHeader: {
      flexDirection:     'row',
      justifyContent:    'space-between',
      alignItems:        'center',
      paddingHorizontal: 20,
      paddingVertical:   12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetTitle: {
      fontSize:   18,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop:        16,
    },
    sheetSection: {
      marginBottom: 20,
    },
    sheetSubtitle: {
      fontSize:       13,
      fontWeight:     '600',
      color:          theme.palette.muted,
      textTransform:  'uppercase',
      letterSpacing:  0.5,
      marginBottom:   12,
    },
    sheetRow: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingVertical:   14,
      paddingHorizontal: 12,
      borderRadius:      10,
      marginBottom:      4,
    },
    sheetRowActive: {
      backgroundColor: theme.colors.softBg,
      borderWidth:     1,
      borderColor:     theme.colors.border,
    },
    sheetRowPressed: {
      opacity: 0.7,
    },
    sheetRowText: {
      fontSize:   15,
      fontWeight: '500',
      color:      theme.palette.onBackground,
    },
    sheetRowTextActive: {
      color:      theme.colors.primary,
      fontWeight: '600',
    },
    activeCheckIcon: {
      fontSize:   16,
      color:      theme.colors.primary,
      fontWeight: '700',
    },
    closeIcon: {
      fontSize: 22,
      color:    theme.palette.muted,
    },
  });
}
