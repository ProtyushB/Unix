import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  User,
  ChevronRight,
  ChevronDown,
  Palette,
  Bell,
  Globe,
  HelpCircle,
  Mail,
  LogOut,
  Shield,
} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AvatarBadge} from '../../components/common/AvatarBadge';
import {AppButton} from '../../components/common/AppButton';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import {PortalSwitcherSheet} from '../../components/common/PortalSwitcherSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigationRef} from '../../navigation/RootNavigator';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {PORTALS, PortalKey, getAvailablePortals} from '../../utils/portals';
import {ProfileStackParamList} from '../../navigation/types';
import {biometricStorage} from '../../storage/biometric.storage';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
}

const SETTINGS_ROWS = [
  {key: 'theme', label: 'Theme', icon: Palette},
  {key: 'notifications', label: 'Notifications', icon: Bell},
  {key: 'language', label: 'Language', icon: Globe},
  {key: 'help', label: 'Help', icon: HelpCircle},
  {key: 'contact', label: 'Contact Us', icon: Mail},
];

export const CustomerProfileScreen: React.FC = () => {
  const profileNav = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPortalSheet, setShowPortalSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

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
    const loadUser = async () => {
      const loggedInStr = await AsyncStorage.getItem('loggedInUser');
      const profileStr = await AsyncStorage.getItem('session:userProfile');
      if (profileStr) {
        setUser(JSON.parse(profileStr));
      } else if (loggedInStr) {
        setUser(JSON.parse(loggedInStr));
      }
    };
    loadUser();
  }, []);

  const availablePortals = getAvailablePortals(user);
  const canSwitchPortal = availablePortals.length > 1;

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

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    try {
      await biometricStorage.logoutClear();
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'Auth'}],
        }),
      );
    } catch {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  }, []);

  const handleSettingPress = (key: string) => {
    switch (key) {
      case 'theme':
        // TODO: open ThemePickerSheet
        break;
      case 'notifications':
        // TODO: notifications settings
        break;
      default:
        break;
    }
  };

  const fullName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : 'User';

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <AppCard style={styles.profileCard}>
          <AvatarBadge name={fullName} size={80} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            {user?.phone && (
              <Text style={styles.profilePhone}>{user.phone}</Text>
            )}
            <TouchableOpacity
              style={styles.rolePill}
              onPress={() => canSwitchPortal && openPortalSheet()}
              activeOpacity={canSwitchPortal ? 0.7 : 1}>
              <User size={11} color={colors.primary} />
              <Text style={styles.rolePillText}>Customer</Text>
              {canSwitchPortal && <ChevronDown size={11} color={colors.primary} />}
            </TouchableOpacity>
          </View>
        </AppCard>

        {/* Security */}
        <TouchableOpacity
          style={styles.securityRow}
          onPress={() => profileNav.navigate('Security')}
          activeOpacity={0.7}>
          <Shield size={20} color={palette.muted} />
          <Text style={styles.settingLabel}>Security</Text>
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
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
          onPress={() => setShowLogoutConfirm(true)}
          style={styles.logoutButton}
        />

        <ConfirmDialog
          visible={showLogoutConfirm}
          title="Logout"
          message="Are you sure you want to logout? You will need to sign in again."
          confirmLabel="Logout"
          cancelLabel="Cancel"
          danger
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />

        <PortalSwitcherSheet
          visible={showPortalSheet}
          activeKey="customer"
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
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginTop: 16,
      marginBottom: 16,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
    profileEmail: {
      fontSize: 14,
      color: theme.palette.muted,
      marginTop: 2,
    },
    profilePhone: {
      fontSize: 14,
      color: theme.palette.muted,
      marginTop: 2,
    },
    rolePill: {marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.softBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.colors.border},
    rolePillText: {fontSize: 11, color: theme.colors.primary, fontWeight: '700', letterSpacing: 0.5},
    settingsSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.palette.muted,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider + '80',
    },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider + '80',
      marginBottom: 16,
    },
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: theme.palette.onBackground,
    },
    logoutButton: {
      marginBottom: 32,
    },
  });
}
