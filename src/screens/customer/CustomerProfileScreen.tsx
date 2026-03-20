import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  User,
  ChevronRight,
  Palette,
  Bell,
  Globe,
  HelpCircle,
  Mail,
  LogOut,
  ArrowRightLeft,
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

  const hasOwnerRole = user?.roles?.includes('BUSINESS_OWNER');

  const handleSwitchToOwner = useCallback(() => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'OwnerTabs'}],
      }),
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
          </View>
        </AppCard>

        {hasOwnerRole && (
          <TouchableOpacity
            style={styles.switchCard}
            onPress={handleSwitchToOwner}
            activeOpacity={0.7}>
            <View style={styles.switchRow}>
              <View style={styles.switchIconContainer}>
                <ArrowRightLeft size={20} color="#f97316" />
              </View>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchTitle}>Switch to Owner Portal</Text>
                <Text style={styles.switchSubtitle}>
                  Manage your businesses
                </Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </View>
          </TouchableOpacity>
        )}

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
  switchCard: {
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTextContainer: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  switchSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
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
