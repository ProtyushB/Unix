import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import {
  ChevronRight, ChevronDown, Palette, Bell, HelpCircle,
  Shield, LogOut, Building2, Lock,
} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AvatarBadge} from '../../components/common/AvatarBadge';
import {AppButton} from '../../components/common/AppButton';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import {Toast} from '../../components/common/Toast';
import {PortalSwitcherSheet} from '../../components/common/PortalSwitcherSheet';
import {useTheme} from '../../hooks/useTheme';
import {useThemeActions} from '../../hooks/useThemeActions';
import {useThemedStyles} from '../../hooks/useThemedStyles';
import {useToast} from '../../hooks/useToast';
import {navigationRef} from '../../navigation/RootNavigator';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ProfileStackParamList} from '../../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AccentName} from '../../theme/theme.types';
import type {AppTheme} from '../../theme/theme.types';
import {PORTALS, PortalKey, getAvailablePortals} from '../../utils/portals';
import {biometricStorage} from '../../storage/biometric.storage';

const SETTINGS_ROWS = [
  {key: 'businesses', label: 'My Businesses', icon: Building2},
  {key: 'notifications', label: 'Notifications', icon: Bell},
  {key: 'help', label: 'Help', icon: HelpCircle},
  {key: 'privacy', label: 'Privacy Policy', icon: Shield},
];

const THEME_OPTIONS: {name: AccentName; color: string; label: string}[] = [
  {name: 'default', color: '#f97316', label: 'Orange'},
  {name: 'ocean', color: '#0ea5e9', label: 'Ocean'},
  {name: 'rose', color: '#e11d48', label: 'Rose'},
  {name: 'emerald', color: '#10b981', label: 'Emerald'},
  {name: 'violet', color: '#8b5cf6', label: 'Violet'},
  {name: 'parlour', color: '#f59e0b', label: 'Gold'},
];

export const AccountScreen: React.FC = () => {
  const profileNav = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { colors, palette, name: accentName } = useTheme();
  const { setAccent } = useThemeActions();
  const styles = useThemedStyles(createStyles);
  const {toasts, showToast} = useToast();
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
      Animated.spring(slideAnim, {toValue: 0, useNativeDriver: true, bounciness: 3, speed: 16}),
      Animated.timing(overlayAnim, {toValue: 1, duration: 250, useNativeDriver: true}),
    ]).start();
  };

  const closePortalSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {toValue: 300, duration: 220, useNativeDriver: true}),
      Animated.timing(overlayAnim, {toValue: 0, duration: 220, useNativeDriver: true}),
    ]).start(() => { setShowPortalSheet(false); callback?.(); });
  };

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
    await biometricStorage.logoutClear();
    navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Auth'}]}));
  }, []);

  const handleSettingPress = (key: string) => {
    if (key === 'theme') setShowThemePicker(true);
  };

  const handleSwitchPortal = useCallback((key: PortalKey) => {
    closePortalSheet(async () => {
      try {
        await AsyncStorage.setItem('session:activeProfile', PORTALS[key].key);
        if (navigationRef.isReady()) {
          navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: PORTALS[key].route}]}));
        }
      } catch {
        // navigation dispatch failed silently
      }
    });
  }, []);

  const availablePortals = getAvailablePortals(user);
  const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User';

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <AppCard style={styles.profileCard}>
          <AvatarBadge name={fullName} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <TouchableOpacity
              style={styles.rolePill}
              onPress={openPortalSheet}
              activeOpacity={0.7}>
              <Building2 size={11} color={colors.primary} />
              <Text style={styles.rolePillText}>Business</Text>
              <ChevronDown size={11} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </AppCard>

        <TouchableOpacity
          style={styles.themeRow}
          onPress={() => profileNav.navigate('Security')}
          activeOpacity={0.7}>
          <Lock size={20} color={palette.muted} />
          <Text style={styles.settingLabel}>Security</Text>
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.themeRow} onPress={() => setShowThemePicker(true)} activeOpacity={0.7}>
          <Palette size={20} color={palette.muted} />
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={[styles.themePreview, {backgroundColor: colors.primary}]} />
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>

        <View style={styles.settingsSection}>
          {SETTINGS_ROWS.map(row => {
            const Icon = row.icon;
            return (
              <TouchableOpacity
                key={row.key}
                style={styles.settingRow}
                onPress={() => handleSettingPress(row.key)}
                activeOpacity={0.7}>
                <Icon size={20} color={palette.muted} />
                <Text style={styles.settingLabel}>{row.label}</Text>
                <ChevronRight size={18} color={palette.divider} />
              </TouchableOpacity>
            );
          })}
        </View>

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

        {showThemePicker && (
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.overlayBg} onPress={() => setShowThemePicker(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Choose Theme</Text>
              <View style={styles.themeGrid}>
                {THEME_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.name}
                    style={styles.themeItem}
                    onPress={() => {
                      setAccent(opt.name);
                      setShowThemePicker(false);
                      showToast(`Theme changed to ${opt.label}`, 'success');
                    }}>
                    <View style={[
                      styles.themeCircle,
                      {backgroundColor: opt.color},
                      accentName === opt.name && styles.themeCircleActive,
                    ]} />
                    <Text style={styles.themeLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        <PortalSwitcherSheet
          visible={showPortalSheet}
          activeKey="business"
          availableKeys={availablePortals}
          slideAnim={slideAnim}
          overlayAnim={overlayAnim}
          onClose={() => closePortalSheet()}
          onSwitch={handleSwitchPortal}
        />

        <Toast toasts={toasts} />
      </View>
    </ScreenWrapper>
  );
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {flex: 1, paddingHorizontal: 16},
    title: {fontSize: 28, fontWeight: '700', color: theme.palette.onBackground, marginTop: 16, marginBottom: 16},
    profileCard: {flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16},
    profileInfo: {flex: 1},
    profileName: {fontSize: 18, fontWeight: '700', color: theme.palette.onBackground},
    profileEmail: {fontSize: 13, color: theme.palette.muted, marginTop: 2},
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
    rolePillText: {fontSize: 11, color: theme.colors.primary, fontWeight: '700', letterSpacing: 0.5},
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
    themePreview: {width: 20, height: 20, borderRadius: 10, marginLeft: 'auto', marginRight: 8},
    settingsSection: {marginBottom: 24},
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider + '4D',
    },
    settingLabel: {flex: 1, fontSize: 16, color: theme.palette.onBackground},
    logoutBtn: {marginBottom: 32},
    overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end'},
    overlayBg: {...StyleSheet.absoluteFillObject, backgroundColor: theme.palette.overlay},
    sheet: {backgroundColor: theme.palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24},
    sheetTitle: {fontSize: 18, fontWeight: '700', color: theme.palette.onBackground, marginBottom: 20},
    themeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 16},
    themeItem: {alignItems: 'center', gap: 8, width: 72},
    themeCircle: {width: 48, height: 48, borderRadius: 24},
    themeCircleActive: {borderWidth: 3, borderColor: theme.palette.onBackground},
    themeLabel: {fontSize: 12, color: theme.palette.muted},
  });
}
