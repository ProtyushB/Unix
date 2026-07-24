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
import { ChevronRight, CircleCheck, Plus, X } from 'lucide-react-native';
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
import { getBusinessTypeIcon, getBusinessTypeLabel } from '../../utils/businessTypes';

// ─── Helpers ───────────────────────────────────────────────────────────────
// Businesses carry an open field bag ([key: string]: unknown). Pull the first
// available location-ish field for the row subtitle; fall back to the type
// label so the two-line row layout always has something to show.
const LOCATION_FIELDS = ['area', 'locality', 'city', 'address', 'businessAddress'];

function getBusinessLocation(biz: Business, type: string): string {
  const parts: string[] = [];
  for (const key of LOCATION_FIELDS) {
    const val = (biz as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.trim()) parts.push(val.trim());
  }
  if (parts.length) return parts.slice(0, 2).join(' · ');
  return getBusinessTypeLabel(type);
}
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
  const { palette, colors } = theme;
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

  const types        = businessTypeMap ? Object.keys(businessTypeMap) : [];
  const businessCount = types.reduce(
    (sum, t) => sum + (businessTypeMap?.[t]?.length ?? 0),
    0,
  );
  const summary = `${businessCount} ${businessCount === 1 ? 'business' : 'businesses'} · ${types.length} ${types.length === 1 ? 'type' : 'types'}`;

  // No owner-side "add business" route exists yet; closing the sheet is the
  // safe placeholder until that flow is wired up.
  const handleAddBusiness = () => closeBusinessSheet();

  if (!rendered) return null;

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Animated.View
        style={[
          isDark ? styles.backdropDark : styles.backdrop,
          { opacity: overlayAnim },
        ]}
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
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: palette.background + 'A6' },
              ]}
            />
          </>
        )}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => closeBusinessSheet()}
        />
      </Animated.View>

      <Animated.View
        style={[
          isDark ? styles.sheetSolidDark : styles.sheetFlat,
          {
            paddingBottom: insets.bottom + 16,
            transform:     [{ translateY: slideAnim }],
          },
        ]}
      >
        {isDark && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: palette.surfaceElevated + '80' },
            ]}
          />
        )}
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleGroup}>
            <Text style={styles.sheetTitle}>Switch business</Text>
            {businessTypeMap && <Text style={styles.sheetSub}>{summary}</Text>}
          </View>
          <Pressable
            onPress={() => closeBusinessSheet()}
            hitSlop={10}
            android_ripple={{ color: palette.divider, borderless: true }}
            style={styles.closeBtn}
          >
            <X size={17} color={palette.muted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.sheetBody}
          contentContainerStyle={styles.sheetBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {businessTypeMap &&
            Object.keys(businessTypeMap).map(type => {
              const list     = businessTypeMap[type] || [];
              const TypeIcon = getBusinessTypeIcon(type);

              return (
                <View key={type} style={styles.sheetSection}>
                  <View style={styles.sheetSectionHead}>
                    <Text style={styles.sheetSubtitle}>
                      {getBusinessTypeLabel(type).toUpperCase()}
                    </Text>
                    <Text style={styles.sheetSectionCount}>· {list.length}</Text>
                  </View>

                  {list.map((biz: Business) => {
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
                        <View style={styles.sheetRowLogo}>
                          <TypeIcon
                            size={20}
                            color={isActive ? colors.primary : palette.muted}
                          />
                        </View>
                        <View style={styles.sheetRowText}>
                          <Text
                            style={[
                              styles.sheetRowName,
                              isActive && styles.sheetRowNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {bizName}
                          </Text>
                          <Text style={styles.sheetRowSub} numberOfLines={1}>
                            {getBusinessLocation(biz, type)}
                          </Text>
                        </View>
                        {isActive ? (
                          <CircleCheck size={22} color={colors.primary} />
                        ) : (
                          <ChevronRight size={18} color={palette.muted} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
        </ScrollView>

        <Pressable
          onPress={handleAddBusiness}
          android_ripple={{ color: palette.divider }}
          style={({ pressed }) => [styles.addBtn, pressed && styles.sheetRowPressed]}
        >
          <Plus size={18} color={colors.primary} />
          <Text style={styles.addBtnLabel}>Add new business</Text>
        </Pressable>
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
    backdropDark: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      overflow:        'hidden',
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
    sheetSolidDark: {
      position:             'absolute',
      left:                 0,
      right:                0,
      bottom:               0,
      maxHeight:            '75%',
      // Theme-aware midpoint: palette.surface base + 50%-alpha
      // palette.surfaceElevated overlay (rendered as a child). Same recipe
      // as GroupSheetOverlay's sheetSolidDark.
      backgroundColor:      theme.palette.surface,
      borderTopLeftRadius:  20,
      borderTopRightRadius: 20,
      paddingTop:           8,
      overflow:             'hidden',
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
      height:          5,
      borderRadius:    999,
      backgroundColor: theme.colors.primary,
      marginTop:       4,
      marginBottom:    8,
    },
    sheetHeader: {
      flexDirection:     'row',
      justifyContent:    'space-between',
      alignItems:        'center',
      paddingHorizontal: 20,
      paddingTop:        8,
      paddingBottom:     16,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    sheetTitleGroup: {
      gap: 3,
    },
    sheetTitle: {
      fontSize:   18,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    sheetSub: {
      fontSize:   12,
      fontWeight: '400',
      color:      theme.palette.muted,
    },
    closeBtn: {
      width:           32,
      height:          32,
      borderRadius:    8,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: theme.palette.background,
      borderWidth:     1,
      borderColor:     theme.palette.divider,
    },
    sheetBody: {
      flexShrink:        1,
      paddingHorizontal: 12,
    },
    sheetBodyContent: {
      paddingTop:    14,
      paddingBottom: 12,
    },
    sheetSection: {
      marginBottom: 16,
    },
    sheetSectionHead: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               8,
      paddingHorizontal: 8,
      marginBottom:      8,
    },
    sheetSubtitle: {
      fontSize:      11,
      fontWeight:    '600',
      color:         theme.palette.muted,
      letterSpacing: 1.2,
    },
    sheetSectionCount: {
      fontSize:   11,
      fontWeight: '500',
      color:      theme.palette.muted,
    },
    sheetRow: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               12,
      paddingVertical:   11,
      paddingHorizontal: 12,
      borderRadius:      12,
      marginBottom:      8,
      backgroundColor:   theme.palette.surface,
      borderWidth:       1,
      borderColor:       theme.palette.divider,
    },
    sheetRowActive: {
      backgroundColor: theme.colors.softBg,
      borderColor:     theme.colors.border,
    },
    sheetRowPressed: {
      opacity: 0.7,
    },
    sheetRowLogo: {
      width:          40,
      height:         40,
      borderRadius:   12,
      alignItems:     'center',
      justifyContent: 'center',
    },
    sheetRowText: {
      flex: 1,
      gap:  3,
    },
    sheetRowName: {
      fontSize:   15,
      fontWeight: '600',
      color:      theme.palette.onBackground,
    },
    sheetRowNameActive: {
      color: theme.colors.primary,
    },
    sheetRowSub: {
      fontSize:   12,
      fontWeight: '400',
      color:      theme.palette.muted,
    },
    addBtn: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'center',
      gap:               8,
      paddingTop:        16,
      paddingBottom:     6,
      borderTopWidth:    1,
      borderTopColor:    theme.palette.divider,
    },
    addBtnLabel: {
      fontSize:   14,
      fontWeight: '600',
      color:      theme.colors.primary,
    },
  });
}
