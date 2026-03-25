import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated,
} from 'react-native';
import {
  ChevronRight, ChevronDown, Palette, Bell, HelpCircle,
  Shield, LogOut, Building2, User, Plus,
} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AvatarBadge} from '../../components/common/AvatarBadge';
import {AppButton} from '../../components/common/AppButton';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import {Toast} from '../../components/common/Toast';
import {useAppContext} from '../../context/AppContext';
import {useToast} from '../../hooks/useToast';
import {navigationRef} from '../../navigation/RootNavigator';
import {CommonActions} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ThemeName, themes} from '../../theme/colors';

const SETTINGS_ROWS = [
  {key: 'businesses', label: 'My Businesses', icon: Building2},
  {key: 'notifications', label: 'Notifications', icon: Bell},
  {key: 'help', label: 'Help', icon: HelpCircle},
  {key: 'privacy', label: 'Privacy Policy', icon: Shield},
];

const THEME_OPTIONS: {name: ThemeName; color: string; label: string}[] = [
  {name: 'default', color: '#f97316', label: 'Orange'},
  {name: 'ocean', color: '#0ea5e9', label: 'Ocean'},
  {name: 'rose', color: '#e11d48', label: 'Rose'},
  {name: 'emerald', color: '#10b981', label: 'Emerald'},
  {name: 'violet', color: '#8b5cf6', label: 'Violet'},
  {name: 'parlour', color: '#f59e0b', label: 'Gold'},
];

export const AccountScreen: React.FC = () => {
  const {theme, setTheme} = useAppContext();
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
    await AsyncStorage.clear();
    navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Auth'}]}));
  }, []);

  const handleSettingPress = (key: string) => {
    if (key === 'theme') setShowThemePicker(true);
  };

  const handleSwitchToCustomer = () => {
    closePortalSheet(() =>
      navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'CustomerTabs'}]}))
    );
  };

  const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User';

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Account</Text>

        <AppCard style={styles.profileCard}>
          <AvatarBadge name={fullName} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <TouchableOpacity
              style={styles.rolePill}
              onPress={openPortalSheet}
              activeOpacity={0.7}>
              <Building2 size={11} color="#f97316" />
              <Text style={styles.rolePillText}>Business</Text>
              <ChevronDown size={11} color="#f97316" />
            </TouchableOpacity>
          </View>
        </AppCard>

        <TouchableOpacity style={styles.themeRow} onPress={() => setShowThemePicker(true)} activeOpacity={0.7}>
          <Palette size={20} color="#64748b" />
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={[styles.themePreview, {backgroundColor: themes[theme]?.primary || '#f97316'}]} />
          <ChevronRight size={18} color="#334155" />
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
                    onPress={() => { setTheme(opt.name); setShowThemePicker(false); showToast(`Theme changed to ${opt.label}`, 'success'); }}>
                    <View style={[styles.themeCircle, {backgroundColor: opt.color}, theme === opt.name && styles.themeCircleActive]} />
                    <Text style={styles.themeLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {showPortalSheet && (
          <View style={styles.overlay}>
            <Animated.View style={[styles.overlayBg, {opacity: overlayAnim}]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => closePortalSheet()} />
            </Animated.View>
            <Animated.View style={[styles.sheet, {transform: [{translateY: slideAnim}]}]}>
              <Text style={styles.sheetTitle}>Switch Portal</Text>
              <TouchableOpacity style={styles.portalOptionActive} activeOpacity={1}>
                <View style={styles.portalIconWrap}>
                  <Building2 size={20} color="#f97316" />
                </View>
                <Text style={styles.portalOptionActiveText}>Business Owner</Text>
                <View style={styles.portalActiveDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.portalOption} onPress={handleSwitchToCustomer} activeOpacity={0.7}>
                <View style={styles.portalIconWrapMuted}>
                  <User size={20} color="#64748b" />
                </View>
                <Text style={styles.portalOptionText}>Customer</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <Toast toasts={toasts} />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 16},
  title: {fontSize: 28, fontWeight: '700', color: '#f8fafc', marginTop: 16, marginBottom: 16},
  profileCard: {flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16},
  profileInfo: {flex: 1},
  profileName: {fontSize: 18, fontWeight: '700', color: '#f8fafc'},
  profileEmail: {fontSize: 13, color: '#94a3b8', marginTop: 2},
  rolePill: {marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)'},
  rolePillText: {fontSize: 11, color: '#f97316', fontWeight: '700', letterSpacing: 0.5},
  portalOptionActive: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 14, padding: 14, marginBottom: 10},
  portalOptionActiveText: {flex: 1, fontSize: 16, fontWeight: '600', color: '#f97316'},
  portalActiveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316'},
  portalOption: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(51,65,85,0.4)', borderWidth: 1, borderColor: 'rgba(51,65,85,0.6)', borderRadius: 14, padding: 14},
  portalOptionText: {flex: 1, fontSize: 16, fontWeight: '600', color: '#94a3b8'},
  portalIconWrap: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center'},
  portalIconWrapMuted: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(51,65,85,0.6)', alignItems: 'center', justifyContent: 'center'},
  themeRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)', marginBottom: 4},
  themePreview: {width: 20, height: 20, borderRadius: 10, marginLeft: 'auto', marginRight: 8},
  settingsSection: {marginBottom: 24},
  settingRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)'},
  settingLabel: {flex: 1, fontSize: 16, color: '#f8fafc'},
  logoutBtn: {marginBottom: 32},
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end'},
  overlayBg: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24},
  sheetTitle: {fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 20},
  themeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 16},
  themeItem: {alignItems: 'center', gap: 8, width: 72},
  themeCircle: {width: 48, height: 48, borderRadius: 24},
  themeCircleActive: {borderWidth: 3, borderColor: '#f8fafc'},
  themeLabel: {fontSize: 12, color: '#94a3b8'},
});
