import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import PasswordInput from '../../components/forms/PasswordInput';
import PasswordChecklist from '../../components/forms/PasswordChecklist';
import PasswordMatch from '../../components/forms/PasswordMatch';
import AppButton from '../../components/common/AppButton';
import StepProgress from '../../components/common/StepProgress';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { setSignupData } from '../../storage/session.storage';
import { validateUsername, PASSWORD_RULES } from '../../utils/validators';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupCredentials'>;

// ─── Component ───────────────────────────────────────────────────────────────

const SignupCredentialsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authService = getAuthService();

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value || value.length < 3) {
        setUsernameStatus('idle');
        return;
      }

      if (!validateUsername(value)) {
        setUsernameStatus('invalid');
        return;
      }

      setUsernameStatus('checking');
      debounceRef.current = setTimeout(async () => {
        try {
          const isAvailable = await authService.checkUsername(value);
          setUsernameStatus(isAvailable ? 'available' : 'taken');
        } catch (err: any) {
          setUsernameStatus('idle');
        }
      }, 500);
    },
    [authService],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleUsernameChange = (value: string) => {
    const sanitized = value.replace(/\s/g, '');
    setUsername(sanitized);
    if (error) setError('');
    checkUsernameAvailability(sanitized);
  };

  // Validation
  const allPasswordRulesPass = PASSWORD_RULES.every(rule => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isUsernameValid = usernameStatus === 'available';
  const isFormValid = isUsernameValid && allPasswordRulesPass && passwordsMatch;

  const handleContinue = async () => {
    setError('');

    if (!isFormValid) return;

    setLoading(true);
    try {
      // Call signup endpoint
      const roles = ['CUSTOMER']; // Default role during signup
      await authService.signup({
        username: username.trim(),
        email,
        password,
        roles,
      });

      // Store signup data in session
      await setSignupData({
        username: username.trim(),
        email,
        password,
      });

      navigation.navigate('ProfilePersonal', {
        email,
        username: username.trim(),
        password,
      });
    } catch (err: any) {
      const message = err?.message || 'Signup failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Username status indicator
  const renderUsernameStatus = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={styles.statusChecking}>Checking...</Text>
          </View>
        );
      case 'available':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: '#22c55e' }}>✓</Text>
            <Text style={styles.statusAvailable}>Available</Text>
          </View>
        );
      case 'taken':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: '#ef4444' }}>✕</Text>
            <Text style={styles.statusTaken}>Username taken</Text>
          </View>
        );
      case 'invalid':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: '#ef4444' }}>✕</Text>
            <Text style={styles.statusTaken}>3-20 chars, letters/numbers/underscores only</Text>
          </View>
        );
      default:
        return null;
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
          <StepProgress
            currentStep={3}
            totalSteps={5}
            onStepPress={(step) => {
              const { email } = route.params;
              const D_USER = 'devuser'; const D_PASS = 'Dev@12345';
              if (step === 1) navigation.navigate('SignupEmail');
              else if (step === 2) navigation.navigate('OtpVerification', { email });
              else if (step === 4) navigation.navigate('ProfilePersonal', { email, username: D_USER, password: D_PASS });
              else if (step === 5) navigation.navigate('ProfileBusiness', { email, username: D_USER, password: D_PASS, firstName: 'Dev', lastName: 'User', phoneNumber: '9999999999' });
            }}
          />

          <View>
            {/* Title */}
            <Text style={styles.title}>Set Credentials</Text>
            <Text style={styles.subtitle}>
              Choose a username and secure password
            </Text>

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
              onChangeText={handleUsernameChange}
              placeholder="e.g. john_doe"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {renderUsernameStatus()}

            {/* Password */}
            <View style={styles.fieldSpacer} />
            <PasswordInput
              label="Password"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (error) setError('');
              }}
              placeholder="Create a strong password"
            />
            <PasswordChecklist password={password} />

            {/* Confirm Password */}
            <View style={styles.fieldSpacer} />
            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (error) setError('');
              }}
              placeholder="Re-enter your password"
            />
            {confirmPassword.length > 0 && (
              <PasswordMatch match={passwordsMatch} />
            )}

            {/* Continue Button */}
            <View style={styles.buttonContainer}>
              <AppButton
                title="Continue"
                onPress={handleContinue}
                variant="primary"
                loading={loading}
                disabled={!isFormValid || loading}
              />
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Title
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#f8fafc',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 28,
    lineHeight: 22,
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

  // Username status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  statusChecking: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#f97316',
    marginLeft: 6,
  },
  statusAvailable: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#22c55e',
    marginLeft: 6,
  },
  statusTaken: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 6,
  },

  // Spacing
  fieldSpacer: {
    height: 8,
  },

  // Button
  buttonContainer: {
    marginTop: 24,
  },
});

export default SignupCredentialsScreen;
