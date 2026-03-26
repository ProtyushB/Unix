import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import StepProgress from '../../components/common/StepProgress';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { validateEmail } from '../../utils/validators';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignupEmail'>;

// ─── Component ───────────────────────────────────────────────────────────────

const SignupEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.prefillEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const authService = getAuthService();

  const handleSendOtp = async () => {
    setError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Email address is required');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authService.requestOtp('email', trimmedEmail);
      navigation.navigate('OtpVerification', { email: trimmedEmail });
    } catch (err: any) {
      const message = err?.message || 'Failed to send OTP. Please try again.';
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
          scrollEnabled={false}
        >
          <StepProgress
            currentStep={1}
            totalSteps={5}
            onStepPress={(step) => {
              const D_EMAIL = 'dev@test.com'; const D_USER = 'devuser'; const D_PASS = 'Dev@12345';
              if (step === 2) navigation.navigate('OtpVerification', { email: D_EMAIL });
              else if (step === 3) navigation.navigate('SignupCredentials', { email: D_EMAIL });
              else if (step === 4) navigation.navigate('ProfilePersonal', { email: D_EMAIL, username: D_USER, password: D_PASS });
              else if (step === 5) navigation.navigate('ProfileBusiness', { email: D_EMAIL, username: D_USER, password: D_PASS, firstName: 'Dev', lastName: 'User', phoneNumber: '9999999999' });
            }}
          />

          <View>
            {/* Title */}
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Enter your email address to get started
            </Text>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <AppInput
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text.replace(/\s/g, ''));
                if (error) setError('');
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Send OTP Button */}
            <View style={styles.buttonContainer}>
              <AppButton
                title="Send OTP"
                onPress={handleSendOtp}
                variant="primary"
                loading={loading}
                disabled={loading || !email.trim()}
              />
            </View>

            {/* Back to Login */}
            <View style={styles.loginRow}>
              <Text style={styles.loginLabel}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
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
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 32,
    },

    // Title
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 28,
      color: theme.palette.onBackground,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      color: theme.palette.muted,
      marginBottom: 32,
      lineHeight: 22,
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

    // Button
    buttonContainer: {
      marginTop: 12,
    },

    // Login link
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    loginLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },
    loginLink: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: theme.colors.primary,
    },
  });
}

export default SignupEmailScreen;
