import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { Fingerprint, User, Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import PasswordInput from '../../components/forms/PasswordInput';
import AppButton from '../../components/common/AppButton';
import { Toast } from '../../components/common/Toast';
import { useToast } from '../../hooks/useToast';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import BrandMark from '../../components/auth/BrandMark';
import AuthHeader from '../../components/auth/AuthHeader';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { getPersonService } from '../../backend/person/provider/person.provider';
import {
  setLoggedInUser,
  getLoggedInUser,
  getRefreshToken,
  clearRefreshToken,
} from '../../storage/auth.storage';
import { setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';
import { biometricStorage } from '../../storage/biometric.storage';
import { promptBiometric } from '../../hooks/useBiometric';
import { PORTALS, isBusinessUser } from '../../utils/portals';
import { CLAIM_ACCOUNT_ENABLED } from '../../config/features';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;


// ─── Component ───────────────────────────────────────────────────────────────

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const { toasts, showToast, dismissToast } = useToast();

  const authService = getAuthService();
  const personService = getPersonService();

  const busy = loading || biometricLoading;

  // Pulls the person profile and caches everything the portals need. Shared by
  // the password and biometric paths so a biometric sign-in restores exactly
  // the same session state as a typed one.
  const cacheProfile = useCallback(
    async (uname: string, fallbackTypes: string[] = []): Promise<string[]> => {
      try {
        const profileResult = await personService.getPersonByUsername(uname);
        if (!profileResult.success || !profileResult.data) return fallbackTypes;

        const userProfile = profileResult.data as any;
        const personTypes: string[] = (userProfile.types as string[]) ?? fallbackTypes;

        await setUserProfile(userProfile);

        if (userProfile.business && (userProfile.business as any[]).length > 0) {
          const typeMap: Record<string, any[]> = {};
          (userProfile.business as any[]).forEach((biz: any) => {
            const type = biz.businessType || 'CUSTOM';
            if (!typeMap[type]) typeMap[type] = [];
            typeMap[type].push(biz);
          });
          await setBusinessTypeMap(typeMap);
        }

        if (userProfile.personFolderId) {
          const dmsFolderMap: DmsFolderMap = {
            userRootFolderId: userProfile.personFolderId as number,
            roleFolders: { Business: 0, Customer: 0, Employee: 0 },
            businesses: {},
          };
          ((userProfile.business as any[]) || []).forEach((biz: any) => {
            const bizId = biz.id || biz.businessId;
            if (bizId) {
              dmsFolderMap.businesses[bizId] = {
                folderId: biz.folderId || 0,
                productsFolderId: 0,
                servicesFolderId: 0,
                ordersFolderId: 0,
                appointmentsFolderId: 0,
                billsFolderId: 0,
              };
            }
          });
          await setDmsFolderMap(dmsFolderMap);
        }

        return personTypes;
      } catch {
        // Sign-in still succeeds if the profile fetch fails — the portals just
        // start colder.
        return fallbackTypes;
      }
    },
    [personService],
  );

  const navigateToPortal = useCallback(
    async (roles: string[], types: string[] = []) => {
      const savedPortal = await AsyncStorage.getItem('session:activeProfile');
      const isBusiness = isBusinessUser(roles, types);
      let portalKey: string;
      if (savedPortal === PORTALS.customer.key) {
        portalKey = PORTALS.customer.key;
      } else if (savedPortal === PORTALS.business.key && isBusiness) {
        portalKey = PORTALS.business.key;
      } else {
        portalKey = isBusiness ? PORTALS.business.key : PORTALS.customer.key;
      }
      await AsyncStorage.setItem('session:activeProfile', portalKey);
      const targetRoute =
        portalKey === PORTALS.business.key ? PORTALS.business.route : PORTALS.customer.route;
      InteractionManager.runAfterInteractions(() => {
        const parent = navigation.getParent();
        (parent ?? navigation).reset({ index: 0, routes: [{ name: targetRoute as any }] });
      });
    },
    [navigation],
  );

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const passed = await promptBiometric('Sign in to Unix');
      if (!passed) {
        setBiometricLoading(false);
        return;
      }
      await authService.refreshToken();
      const storedUser = await getLoggedInUser();

      let profileTypes: string[] = storedUser?.types ?? [];
      if (storedUser?.username) {
        profileTypes = await cacheProfile(storedUser.username, profileTypes);
        await setLoggedInUser({ ...storedUser, types: profileTypes });
      }

      await navigateToPortal(storedUser?.roles ?? [], profileTypes);
    } catch {
      // Refresh token expired — drop the biometric session and fall back to a
      // typed password.
      await AsyncStorage.multiRemove(['refreshToken', 'loggedInUser']);
      setBiometricReady(false);
      setBiometricLoading(false);
      showToast('Please sign in with your password.', 'warning', { title: 'Session expired' });
    }
  }, [authService, cacheProfile, navigateToPortal, showToast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const enabled = await biometricStorage.isEnabled();
      const token = await getRefreshToken();
      if (enabled && token) {
        if (mounted) setBiometricReady(true);
        setTimeout(() => {
          if (mounted) handleBiometricLogin();
        }, 400);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      showToast('Enter both your username and password.', 'error', { title: 'Missing details' });
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(username.trim(), password);
      const user = response.user as any;

      const personTypes = await cacheProfile(username.trim());

      if (user) {
        await setLoggedInUser({
          id: user.id,
          username: user.username,
          roles: user.roles || [],
          types: personTypes,
          email: user.email || '',
        });
      }

      // "Remember me" governs whether the session survives a restart. Dropping
      // the refresh token is what actually forces a fresh sign-in next launch —
      // the access token expires on its own.
      if (!rememberMe) {
        await clearRefreshToken();
      }

      await navigateToPortal(user?.roles || [], personTypes);
    } catch (err: any) {
      const raw = (err?.message || '').toLowerCase();
      let message: string;
      if (raw.includes('invalid credentials')) {
        message = 'Incorrect password. Please try again.';
      } else if (raw.includes('not found with username')) {
        message = 'No account found with that username.';
      } else if (
        raw.includes('network') ||
        raw.includes('econnrefused') ||
        raw.includes('timeout') ||
        raw.includes('enotfound')
      ) {
        message = 'Unable to connect. Please check your internet connection.';
      } else {
        message = 'Login failed. Please try again.';
      }
      showToast(message, 'error', { title: 'Sign in failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandMark />

          <AuthHeader
            title="Welcome back"
            subtitle="Enter your credentials to access your dashboard"
          />

          {/* Form — dimmed while a sign-in is in flight (state 01b) */}
          <View style={[styles.form, busy && styles.dimmed]} pointerEvents={busy ? 'none' : 'auto'}>
            <AppInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<User size={18} color={palette.muted} />}
            />
            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
            />
          </View>

          {/* Remember me · Forgot password */}
          <View style={[styles.optionsRow, busy && styles.dimmed]}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe && <Check size={13} color={colors.onAccent} />}
              </View>
              <Text style={styles.rememberLabel}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPasswordEmail')}
              disabled={busy}
            >
              <Text style={styles.linkStrong}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary recovery routes */}
          <View style={styles.recoveryRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotUsernameEmail')}
              disabled={busy}
            >
              <Text style={styles.link}>Forgot username?</Text>
            </TouchableOpacity>
            {CLAIM_ACCOUNT_ENABLED && (
              <>
                <Text style={styles.dot}>·</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Signup', { claim: true })}
                  disabled={busy}
                >
                  <Text style={styles.link}>Claim account</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <AppButton
            title={loading ? 'Signing In...' : 'Sign In'}
            onPress={handleLogin}
            variant="primary"
            loading={loading}
            disabled={busy}
          />

          {/* Biometric quick-login — no mockup equivalent; mobile-only affordance */}
          {biometricReady && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={busy}
              activeOpacity={0.7}
            >
              {biometricLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Fingerprint size={22} color={colors.primary} />
              )}
              <Text style={styles.biometricText}>
                {biometricLoading ? 'Verifying...' : 'Sign in with Fingerprint'}
              </Text>
            </TouchableOpacity>
          )}


          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={busy}>
              <Text style={styles.linkStrong}>Sign up free</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.palette.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 34,
      gap: 26,
    },

    form: {
      gap: 18,
    },
    dimmed: {
      opacity: 0.5,
    },

    optionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.palette.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    rememberLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 13.5,
      color: theme.palette.onSurface,
    },

    recoveryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    link: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      color: theme.colors.secondary,
    },
    linkStrong: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13.5,
      color: theme.colors.secondary,
    },
    dot: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      color: theme.palette.muted,
    },

    biometricButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.softBg,
    },
    biometricText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      color: theme.colors.primary,
    },

    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },
  });
}

export default LoginScreen;
