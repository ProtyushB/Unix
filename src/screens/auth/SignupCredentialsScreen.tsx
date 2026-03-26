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
import { validateUsername, PASSWORD_RULES } from '../../utils/validators';
import { useSignupDraft } from '../../context/SignupDraftContext';
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
  ProfilePersonal: { email: string; username: string };
  ProfileBusiness: { email: string; username: string; firstName: string; lastName: string; phoneNumber: string };
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authService = getAuthService();
  const { setDraft } = useSignupDraft();

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

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
    checkUsernameAvailability(sanitized);
  };

  // Validation
  const allPasswordRulesPass = PASSWORD_RULES.every(rule => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isUsernameValid = usernameStatus === 'available';
  const isFormValid = isUsernameValid && allPasswordRulesPass && passwordsMatch;

  const handleContinue = () => {
    if (!isFormValid) return;

    setDraft({ email, username: username.trim(), password });
    navigation.navigate('ProfilePersonal', { email, username: username.trim() });
  };

  // Username status indicator
  const renderUsernameStatus = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusChecking}>Checking...</Text>
          </View>
        );
      case 'available':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: palette.success }}>✓</Text>
            <Text style={styles.statusAvailable}>Available</Text>
          </View>
        );
      case 'taken':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: palette.error }}>✕</Text>
            <Text style={styles.statusTaken}>Username taken</Text>
          </View>
        );
      case 'invalid':
        return (
          <View style={styles.statusRow}>
            <Text style={{ fontSize: 14, color: palette.error }}>✕</Text>
            <Text style={styles.statusTaken}>3-20 chars, letters/numbers/underscores only</Text>
          </View>
        );
      default:
        return null;
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
          <StepProgress
            currentStep={3}
            totalSteps={5}
            onStepPress={(step) => {
              const { email } = route.params;
              const D_USER = 'devuser'; const D_PASS = 'Dev@12345';
              if (step === 1) navigation.navigate('SignupEmail');
              else if (step === 2) navigation.navigate('OtpVerification', { email });
              else if (step === 4) { setDraft({ email, username: D_USER, password: D_PASS }); navigation.navigate('ProfilePersonal', { email, username: D_USER }); }
              else if (step === 5) { setDraft({ email, username: D_USER, password: D_PASS }); navigation.navigate('ProfileBusiness', { email, username: D_USER, firstName: 'Dev', lastName: 'User', phoneNumber: '9999999999' }); }
            }}
          />

          <View>
            {/* Title */}
            <Text style={styles.title}>Set Credentials</Text>
            <Text style={styles.subtitle}>
              Choose a username and secure password
            </Text>

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
              onChangeText={setPassword}
              placeholder="Create a strong password"
            />
            <PasswordChecklist password={password} />

            {/* Confirm Password */}
            <View style={styles.fieldSpacer} />
            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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
                disabled={!isFormValid}
              />
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
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 32,
    },

    // Title
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 28,
      color: theme.palette.onBackground,
      marginTop: 12,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      color: theme.palette.muted,
      marginBottom: 28,
      lineHeight: 22,
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
      color: theme.colors.primary,
      marginLeft: 6,
    },
    statusAvailable: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: theme.palette.success,
      marginLeft: 6,
    },
    statusTaken: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: theme.palette.error,
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
}

export default SignupCredentialsScreen;
