import React, {useState, useEffect, useCallback} from 'react';
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
import {Fingerprint} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import PasswordInput from '../../components/forms/PasswordInput';
import AppButton from '../../components/common/AppButton';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { getPersonService } from '../../backend/person/provider/person.provider';
import {
  setLoggedInUser,
  getLoggedInUser,
  getRefreshToken,
} from '../../storage/auth.storage';
import { setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';
import {biometricStorage} from '../../storage/biometric.storage';
import {promptBiometric} from '../../hooks/useBiometric';
import {PORTALS, isBusinessUser} from '../../utils/portals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Param List ──────────────────────────────────────────────────────────────

type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: { prefillEmail?: string } | undefined;
  OtpVerification: { email: string };
  SignupCredentials: { email: string };
  ProfilePersonal: { email: string; username: string; password: string };
  ProfileBusiness: { email: string; username: string; password: string; firstName: string; lastName: string; phoneNumber: string };
  Review: { personal: any; businesses: any[] };
  PortalSelection: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOtp: { email: string };
  ForgotPasswordNew: { email: string };
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// ─── Component ───────────────────────────────────────────────────────────────

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const authService = getAuthService();
  const personService = getPersonService();

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
      const targetRoute = portalKey === PORTALS.business.key
        ? PORTALS.business.route
        : PORTALS.customer.route;
      InteractionManager.runAfterInteractions(() => {
        const parent = navigation.getParent();
        (parent ?? navigation).reset({index: 0, routes: [{name: targetRoute as any}]});
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
      // Use the stored refresh token to silently get a new access token
      await authService.refreshToken();
      const storedUser = await getLoggedInUser();

      // Restore session profile (cleared on logout) so portals and features work correctly
      let profileTypes: string[] = storedUser?.types ?? [];
      if (storedUser?.username) {
        try {
          const profileResult = await personService.getPersonByUsername(storedUser.username);
          if (profileResult.success && profileResult.data) {
            const userProfile = profileResult.data;
            profileTypes = (userProfile.types as string[]) ?? profileTypes;
            await setUserProfile(userProfile);
            // Keep loggedInUser.types up to date
            await setLoggedInUser({...storedUser, types: profileTypes});
            if (userProfile.business && (userProfile.business as any[]).length > 0) {
              const typeMap: Record<string, any[]> = {};
              (userProfile.business as any[]).forEach((biz: any) => {
                const type = biz.businessType || 'CUSTOM';
                if (!typeMap[type]) typeMap[type] = [];
                typeMap[type].push(biz);
              });
              await setBusinessTypeMap(typeMap);
            }
          }
        } catch {
          // Continue even if profile restore fails
        }
      }

      await navigateToPortal(storedUser?.roles ?? [], profileTypes);
    } catch {
      // Refresh token expired — clear biometric session, fall back to password
      await AsyncStorage.multiRemove(['refreshToken', 'loggedInUser']);
      setBiometricReady(false);
      setBiometricLoading(false);
      setError('Your session expired. Please sign in with your password.');
    }
  }, [authService, personService, navigateToPortal]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const enabled = await biometricStorage.isEnabled();
      const token = await getRefreshToken();
      if (enabled && token) {
        if (mounted) setBiometricReady(true);
        // Auto-prompt after the screen finishes animating in
        setTimeout(() => {
          if (mounted) handleBiometricLogin();
        }, 400);
      }
    })();
    return () => {mounted = false;};
  }, []);

  const handleLogin = async () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Login and get auth tokens
      const response = await authService.login(username.trim(), password);
      const user = response.user as any;

      if (user) {
        await setLoggedInUser({
          id: user.id,
          username: user.username,
          roles: user.roles || [],
          email: user.email || '',
        });
      }

      // Step 2: Fetch person profile by username
      let personTypes: string[] = [];
      try {
        const profileResult = await personService.getPersonByUsername(username.trim());
        if (profileResult.success && profileResult.data) {
          const userProfile = profileResult.data;

          // Capture person types (source of truth for portal access)
          personTypes = (userProfile.types as string[]) || [];

          // Update loggedInUser with types so RootNavigator can use them on next open
          if (user) {
            await setLoggedInUser({
              id: user.id,
              username: user.username,
              roles: user.roles || [],
              types: personTypes,
              email: user.email || '',
            });
          }

          // Store user profile
          await setUserProfile(userProfile);

          // Build and store businessTypeMap
          if (userProfile.business && (userProfile.business as any[]).length > 0) {
            const typeMap: Record<string, any[]> = {};
            (userProfile.business as any[]).forEach((biz: any) => {
              const type = biz.businessType || 'CUSTOM';
              if (!typeMap[type]) typeMap[type] = [];
              typeMap[type].push(biz);
            });
            await setBusinessTypeMap(typeMap);
          }

          // Build and store dmsFolderMap from person profile
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
        }
      } catch {
        // Continue with navigation even if profile fetch fails
      }

      // Step 3: Navigate directly to the right portal and persist the choice
      const isBusiness = isBusinessUser(user?.roles || [], personTypes);
      const portalKey = isBusiness ? PORTALS.business.key : PORTALS.customer.key;
      const targetRoute = isBusiness ? PORTALS.business.route : PORTALS.customer.route;
      await AsyncStorage.setItem('session:activeProfile', portalKey);
      // navigateToPortal is also called here via direct reset — types already persisted above

      InteractionManager.runAfterInteractions(() => {
        const parent = navigation.getParent();
        (parent ?? navigation).reset({
          index: 0,
          routes: [{ name: targetRoute as any }],
        });
      });
    } catch (err: any) {
      const raw = (err?.message || '').toLowerCase();
      let message: string;
      if (raw.includes('invalid credentials')) {
        message = 'Incorrect password. Please try again.';
      } else if (raw.includes('not found with username')) {
        message = 'No account found with that username.';
      } else if (raw.includes('network') || raw.includes('econnrefused') || raw.includes('timeout') || raw.includes('enotfound')) {
        message = 'Unable to connect. Please check your internet connection.';
      } else {
        message = 'Login failed. Please try again.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoText}>Uni</Text>
              <Text style={styles.logoAccent}>X</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Username */}
            <AppInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
            />

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => navigation.navigate('ForgotPasswordEmail')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <AppButton
              title="Login"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={loading || biometricLoading}
            />

            {/* Biometric Quick-Login */}
            {biometricReady && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  disabled={biometricLoading || loading}
                  activeOpacity={0.7}>
                  {biometricLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Fingerprint size={22} color={colors.primary} />
                  )}
                  <Text style={styles.biometricText}>
                    {biometricLoading ? 'Verifying...' : 'Sign in with Fingerprint'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Sign Up Link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupLabel}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignupEmail')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
      paddingHorizontal: 24,
      paddingVertical: 40,
    },

    // Header
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    logoText: {
      fontFamily: 'Inter-ExtraBold',
      fontSize: 36,
      color: theme.palette.onBackground,
      letterSpacing: -1,
    },
    logoAccent: {
      fontFamily: 'Inter-ExtraBold',
      fontSize: 36,
      color: theme.colors.primary,
      letterSpacing: -1,
    },

    // Card
    card: {
      backgroundColor: theme.palette.surface,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    cardTitle: {
      fontFamily: 'Inter-Bold',
      fontSize: 24,
      color: theme.palette.onBackground,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
      marginBottom: 24,
    },

    // Error
    errorContainer: {
      backgroundColor: theme.palette.error + '20',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.palette.error + '40',
    },
    errorText: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.palette.error + 'CC',
      textAlign: 'center',
    },

    // Forgot
    forgotLink: {
      alignSelf: 'flex-end',
      marginBottom: 20,
      marginTop: -4,
    },
    forgotText: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.colors.primary,
    },

    // Signup
    signupRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    signupLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },
    signupLink: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: theme.colors.primary,
    },

    // Biometric
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      gap: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.palette.divider,
    },
    dividerText: {
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primary + '14',
    },
    biometricText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      color: theme.colors.primary,
    },
  });
}

export default LoginScreen;
