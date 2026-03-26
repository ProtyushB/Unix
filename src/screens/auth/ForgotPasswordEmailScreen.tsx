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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordEmail'>;

// ─── Component ───────────────────────────────────────────────────────────────

const ForgotPasswordEmailScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const authService = getAuthService();

  const handleSendOtp = async () => {
    setError('');

    const trimmedEmail = email.trim().toLowerCase();

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
      await authService.requestResetPasswordOtp('email', trimmedEmail);
      navigation.navigate('ForgotPasswordOtp', { email: trimmedEmail });
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
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Text style={{ fontSize: 32 }}>🔑</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a verification code to reset your password.
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
              setEmail(text);
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
              disabled={loading}
            />
          </View>

          {/* Back to Login */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>
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

    // Icon
    iconContainer: {
      alignItems: 'center',
      marginBottom: 28,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '14',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.primary + '33',
    },

    // Title
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 28,
      color: theme.palette.onBackground,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      color: theme.palette.muted,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
      paddingHorizontal: 12,
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
      marginTop: 8,
    },

    // Back link
    backLink: {
      alignSelf: 'center',
      marginTop: 24,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    backLinkText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: theme.colors.primary,
    },
  });
}

export default ForgotPasswordEmailScreen;
