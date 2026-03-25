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
  Building2,
} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AvatarBadge} from '../../components/common/AvatarBadge';
import {AppButton} from '../../components/common/AppButton';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigationRef} from '../../navigation/RootNavigator';
import {CommonActions} from '@react-navigation/native';

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  const hasOwnerRole =
    (user as any)?.types?.includes('BUSINESS_OWNER') ||
    user?.roles?.includes('BUSINESS_OWNER');

  const handleSwitchToOwner = useCallback(() => {
    closePortalSheet(() =>
      navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'OwnerTabs'}]}))
    );
  }, []);

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    try {
      await AsyncStorage.clear();
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
              onPress={() => hasOwnerRole && openPortalSheet()}
              activeOpacity={hasOwnerRole ? 0.7 : 1}>
              <User size={11} color="#f97316" />
              <Text style={styles.rolePillText}>Customer</Text>
              {hasOwnerRole && <ChevronDown size={11} color="#f97316" />}
            </TouchableOpacity>
          </View>
        </AppCard>

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
                <Icon size={20} color="#64748b" />
                <Text style={styles.settingLabel}>{row.label}</Text>
                <ChevronRight size={18} color="#334155" />
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

        {showPortalSheet && (
          <View style={styles.overlay}>
            <Animated.View style={[styles.overlayBg, {opacity: overlayAnim}]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => closePortalSheet()} />
            </Animated.View>
            <Animated.View style={[styles.sheet, {transform: [{translateY: slideAnim}]}]}>
              <Text style={styles.sheetTitle}>Switch Portal</Text>
              <TouchableOpacity style={styles.portalOptionActive} activeOpacity={1}>
                <View style={styles.portalIconWrap}>
                  <User size={20} color="#f97316" />
                </View>
                <Text style={styles.portalOptionActiveText}>Customer</Text>
                <View style={styles.portalActiveDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.portalOption} onPress={handleSwitchToOwner} activeOpacity={0.7}>
                <View style={styles.portalIconWrapMuted}>
                  <Building2 size={20} color="#64748b" />
                </View>
                <Text style={styles.portalOptionText}>Business Owner</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
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
    color: '#f8fafc',
  },
  profileEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  rolePill: {marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)'},
  rolePillText: {fontSize: 11, color: '#f97316', fontWeight: '700', letterSpacing: 0.5},
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end'},
  overlayBg: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24},
  sheetTitle: {fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16},
  portalOptionActive: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 14, padding: 14, marginBottom: 10},
  portalOptionActiveText: {flex: 1, fontSize: 16, fontWeight: '600', color: '#f97316'},
  portalActiveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316'},
  portalOption: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(51,65,85,0.4)', borderWidth: 1, borderColor: 'rgba(51,65,85,0.6)', borderRadius: 14, padding: 14},
  portalOptionText: {flex: 1, fontSize: 16, fontWeight: '600', color: '#94a3b8'},
  portalIconWrap: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center'},
  portalIconWrapMuted: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(51,65,85,0.6)', alignItems: 'center', justifyContent: 'center'},
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
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
    borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: '#f8fafc',
  },
  logoutButton: {
    marginBottom: 32,
  },
});
