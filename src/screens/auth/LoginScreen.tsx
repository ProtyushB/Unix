import React, { useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import PasswordInput from '../../components/forms/PasswordInput';
import AppButton from '../../components/common/AppButton';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { getPersonService } from '../../backend/person/provider/person.provider';
import {
  setLoggedInUser,
} from '../../storage/auth.storage';
import { setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';

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

  const authService = getAuthService();
  const personService = getPersonService();

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
      let personTypes: string[] = user?.roles || [];
      try {
        const profileResult = await personService.getPersonByUsername(username.trim());
        if (profileResult.success && profileResult.data) {
          const userProfile = profileResult.data;

          // Store user profile
          await setUserProfile(userProfile);

          // Capture person types from profile
          personTypes = (userProfile.types as string[]) || personTypes;

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

      // Step 3: Navigate directly to the right portal
      const isBusinessOwner = personTypes.includes('BUSINESS_OWNER');
      const targetRoute = isBusinessOwner ? 'OwnerTabs' : 'CustomerTabs';

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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
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
              disabled={loading}
            />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    color: '#f8fafc',
    letterSpacing: -1,
  },
  logoAccent: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 36,
    color: '#f97316',
    letterSpacing: -1,
  },

  // Card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },

  // Error
  errorContainer: {
    backgroundColor: '#ef444420',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#fca5a5',
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
    color: '#f97316',
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
    color: '#94a3b8',
  },
  signupLink: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#f97316',
  },
});

export default LoginScreen;
