import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronDown,
  Palette,
  Bell,
  HelpCircle,
  Shield,
  LogOut,
  Building2,
  Lock,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AvatarBadge } from '../../components/common/AvatarBadge';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PortalSwitcherSheet } from '../../components/common/PortalSwitcherSheet';
import { useTheme } from '../../hooks/useTheme';
import { useThemeActions } from '../../hooks/useThemeActions';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useToast } from '../../hooks/useToast';
import { navigationRef } from '../../navigation/RootNavigator';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppTheme, ThemeId } from '../../theme/theme.types';
import { THEMES, type ThemeDefinition } from '../../theme/colors';
import { PORTALS, PortalKey, getAvailablePortals } from '../../utils/portals';
import { biometricStorage } from '../../storage/biometric.storage';
import { clearTabConfigCache } from '../../backend/tab-config';
import { resetRefreshState } from '../../backend/shared/config/authInterceptors';
import { AppVersionRow } from '../../components/common/AppVersionRow';

const SETTINGS_ROWS = [
  { key: 'businesses', label: 'My Businesses', icon: Building2 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'help', label: 'Help', icon: HelpCircle },
  { key: 'privacy', label: 'Privacy Policy', icon: Shield },
];

const ALL_THEMES = Object.values(THEMES);
const DARK_THEMES = ALL_THEMES.filter((t) => t.mode === 'dark');
const LIGHT_THEMES = ALL_THEMES.filter((t) => t.mode === 'light');

// ─── Theme swatch — surface background + accent dot + label ────────────────
// Mirrors the web Centrix ThemePreview tile. `styles` is passed in so we
// can reuse the themed StyleSheet from the screen.

const ThemeSwatch: React.FC<{
  theme: ThemeDefinition;
  active: boolean;
  styles: ReturnType<typeof createStyles>;
  onPick: (id: ThemeId, label: string) => void;
}> = ({ theme, active, styles, onPick }) => {
  const [surface, accent] = theme.swatch;
  return (
    <TouchableOpacity
      style={styles.themeItem}
      activeOpacity={0.7}
      onPress={() => onPick(theme.id, theme.name)}
    >
      <View
        style={[
          styles.themeSwatch,
          { backgroundColor: surface },
          active && styles.themeSwatchActive,
          active && { borderColor: accent },
        ]}
      >
        <View style={[styles.themeSwatchDot, { backgroundColor: accent }]} />
      </View>
      <Text
        style={[styles.themeLabel, active && styles.themeLabelActive, active && { color: accent }]}
      >
        {theme.name}
      </Text>
    </TouchableOpacity>
  );
};

export const AccountScreen: React.FC = () => {
  const profileNav = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { colors, palette, name: currentThemeId } = useTheme();
  const { setTheme } = useThemeActions();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  // For the theme sheet: it renders in a Modal window, outside this screen's SafeAreaView.
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showPortalSheet, setShowPortalSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openPortalSheet = () => {
    slideAnim.setValue(300);
    overlayAnim.setValue(0);
    setShowPortalSheet(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 16 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  // useCallback so handleSwitchPortal below can depend on it honestly. Everything it closes over is
  // already stable — two useRef animated values and a setState — so this never changes identity.
  const closePortalSheet = useCallback(
    (callback?: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setShowPortalSheet(false);
        callback?.();
      });
    },
    [slideAnim, overlayAnim],
  );

  useEffect(() => {
    const load = async () => {
      const str = await AsyncStorage.getItem('session:userProfile');
      if (str) setUser(JSON.parse(str));
      else {
        const u = await AsyncStorage.getItem('loggedInUser');
        if (u) setUser(JSON.parse(u));
      }
    };
    load();
  }, []);

  const handleLogout = useCallback(async () => {
    setShowLogout(false);
    // logoutClear only removes a fixed key list; the tab-config cache is per-business suffixed
    // and lives partly in module memory, so it needs its own sweep. Without it, logging in as a
    // different owner within the 5-minute TTL paints the previous account's navbar.
    await Promise.all([biometricStorage.logoutClear(), clearTabConfigCache()]);
    resetRefreshState();
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
  }, []);

  const handleSettingPress = (key: string) => {
    if (key === 'theme') setShowThemePicker(true);
  };

  const handleSwitchPortal = useCallback(
    (key: PortalKey) => {
      closePortalSheet(async () => {
        try {
          await AsyncStorage.setItem('session:activeProfile', PORTALS[key].key);
          if (navigationRef.isReady()) {
            navigationRef.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: PORTALS[key].route }] }),
            );
          }
        } catch {
          // navigation dispatch failed silently
        }
      });
    },
    [closePortalSheet],
  );

  const availablePortals = getAvailablePortals(user);
  const canSwitchPortal = availablePortals.length > 1;
  const fullName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
    : 'User';

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        {/* contentStyle is required, not optional polish. In DARK themes AppCard
            wraps its children in an inner cardContent view (centred column), so a
            flexDirection on `style` lands on the outer container — which has only
            that one child — and never reaches the avatar or the details. Light
            themes have no wrapper, which is why this card looked right in Dawn and
            stacked vertically in Midnight. Both props are needed to cover both. */}
        <AppCard style={styles.profileCard} contentStyle={styles.profileCardContent}>
          <AvatarBadge name={fullName} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            {/* The portal dropdown is the only way into the customer portal, so it
                disappears entirely while CUSTOMER_PORTAL_ENABLED is off — not just
                disabled, since a dead control invites taps. Gated on "is there
                more than one portal to choose from" rather than on the flag
                directly, which is the honest condition and also hides the pill for
                a single-portal user once the feature returns. */}
            {canSwitchPortal && (
              <TouchableOpacity
                style={styles.rolePill}
                onPress={openPortalSheet}
                activeOpacity={0.7}
              >
                <Building2 size={11} color={colors.primary} />
                <Text style={styles.rolePillText}>Business</Text>
                <ChevronDown size={11} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </AppCard>

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => profileNav.navigate('Security')}
          activeOpacity={0.7}
        >
          <Lock size={20} color={palette.muted} />
          <Text style={styles.settingLabel}>Security</Text>
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => setShowThemePicker(true)}
          activeOpacity={0.7}
        >
          <Palette size={20} color={palette.muted} />
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={[styles.themePreview, { backgroundColor: colors.primary }]} />
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>

        <View style={styles.settingsSection}>
          {SETTINGS_ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <TouchableOpacity
                key={row.key}
                style={styles.settingRow}
                onPress={() => handleSettingPress(row.key)}
                activeOpacity={0.7}
              >
                <Icon size={20} color={palette.muted} />
                <Text style={styles.settingLabel}>{row.label}</Text>
                <ChevronRight size={18} color={palette.divider} />
              </TouchableOpacity>
            );
          })}
        </View>

        <AppVersionRow />

        <AppButton
          title="Logout"
          variant="danger"
          leftIcon={<LogOut size={18} color="#fff" />}
          onPress={() => setShowLogout(true)}
          style={styles.logoutBtn}
        />

        <ConfirmDialog
          visible={showLogout}
          title="Logout"
          message="Are you sure you want to logout?"
          confirmLabel="Logout"
          cancelLabel="Cancel"
          danger
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />

        {/*
          A real Modal, not an absolutely-positioned View. It used to live inside this screen's
          content, which sits inside ScreenWrapper's ScrollView — so it anchored to the scroll
          content's height rather than the viewport and dropped below the fold once the page grew,
          its scrim started below the status bar (an absolute child gets no safe-area padding), and
          it never covered the tab bar, leaving the tabs tappable behind a supposedly blocking
          sheet. A Modal gets its own window and fixes all three at once. Same prop set as
          ConfirmDialog and PortalSwitcherSheet.
        */}
        <Modal
          visible={showThemePicker}
          transparent
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setShowThemePicker(false)}
        >
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.overlayBg} onPress={() => setShowThemePicker(false)} />
            <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
              <Text style={styles.sheetTitle}>Choose Theme</Text>

              {/* maxHeight on the sheet without a scroller would simply clip the Light grid on a
                  short device. */}
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetSection}>Dark</Text>
                <View style={styles.themeGrid}>
                  {DARK_THEMES.map((t) => (
                    <ThemeSwatch
                      key={t.id}
                      theme={t}
                      active={currentThemeId === t.id}
                      styles={styles}
                      onPick={(id: ThemeId, label: string) => {
                        setTheme(id);
                        setShowThemePicker(false);
                        showToast(`Theme changed to ${label}`, 'success');
                      }}
                    />
                  ))}
                </View>

                <Text style={[styles.sheetSection, styles.sheetSectionSpaced]}>Light</Text>
                <View style={styles.themeGrid}>
                  {LIGHT_THEMES.map((t) => (
                    <ThemeSwatch
                      key={t.id}
                      theme={t}
                      active={currentThemeId === t.id}
                      styles={styles}
                      onPick={(id: ThemeId, label: string) => {
                        setTheme(id);
                        setShowThemePicker(false);
                        showToast(`Theme changed to ${label}`, 'success');
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <PortalSwitcherSheet
          visible={showPortalSheet}
          activeKey="business"
          availableKeys={availablePortals}
          slideAnim={slideAnim}
          overlayAnim={overlayAnim}
          onClose={() => closePortalSheet()}
          onSwitch={handleSwitchPortal}
        />
      </View>
    </ScreenWrapper>
  );
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginTop: 16,
      marginBottom: 16,
    },
    profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
    // Mirrors profileCard's layout onto the dark-theme inner wrapper. Padding is
    // deliberately not set here so AppCard's own 16 is preserved by the merge.
    profileCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 16,
    },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 18, fontWeight: '700', color: theme.palette.onBackground },
    profileEmail: { fontSize: 13, color: theme.palette.muted, marginTop: 2 },
    rolePill: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.softBg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rolePillText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider + '4D',
      marginBottom: 4,
    },
    themePreview: { width: 20, height: 20, borderRadius: 10, marginLeft: 'auto', marginRight: 8 },
    settingsSection: { marginBottom: 24 },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider + '4D',
    },
    settingLabel: { flex: 1, fontSize: 16, color: theme.palette.onBackground },
    logoutBtn: { marginBottom: 32 },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
    },
    overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.palette.overlay },
    sheet: {
      backgroundColor: theme.palette.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      maxHeight: '85%',
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 16,
    },
    sheetSection: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.palette.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    themeItem: { alignItems: 'center', gap: 6, width: 70 },
    themeSwatch: {
      width: 56,
      height: 56,
      borderRadius: 12,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: 6,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    themeSwatchDot: { width: 14, height: 14, borderRadius: 7 },
    themeLabel: { fontSize: 11, color: theme.palette.muted, textAlign: 'center' },
    // Selection ring width and label weight. The accent COLOUR is the theme being previewed, so it
    // is necessarily dynamic and stays at the call site — only the static half moves here.
    themeSwatchActive: { borderWidth: 2 },
    themeLabelActive: { fontWeight: '700' },
    /** Gap above the second theme group ("Light"), which follows "Dark" rather than opening the sheet. */
    sheetSectionSpaced: { marginTop: 18 },
  });
}
