import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Mail } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OtpInput } from '../../components/forms/OtpInput';
import AppButton from '../../components/common/AppButton';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthTopBack from '../../components/auth/AuthTopBack';
import AuthBackLink from '../../components/auth/AuthBackLink';
import AuthBadge from '../../components/auth/AuthBadge';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { extractErrorMessage } from '../../backend/shared/http/axiosError';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

const RESEND_COOLDOWN = 60;

// Mockup 06 — step two of three.

const ForgotPasswordOtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const authService = getAuthService();

  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startCooldown]);

  const handleVerify = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const isValid = await authService.verifyResetPasswordOtp('email', email, otp);
      if (isValid) {
        navigation.navigate('ForgotPasswordNew', { email });
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      // Pre-login screen, so the raw text of a 500 is readable by anyone: `auth-service` writes
      // `"Internal server error: " + ex.getMessage()` into both wrapper fields, and until the gate
      // was put in front of the display that arrived here whole. An earlier version of this comment
      // credited the endpoint with two curated refusals — "OTP not verified for reset" and the
      // password-reset expiry sentence — which belong to `resetPassword`, the NEXT screen's call.
      // `verifyResetPasswordOtp` throws none of its own: a wrong code comes back as
      // `verified(false)` and is handled in the `else` above, so what reaches this catch is a
      // transport failure or a 500. The gate matters here for that reason rather than in spite of
      // it — there is no curated sentence to preserve, only text nobody wrote for a user.
      setError(extractErrorMessage(err, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      await authService.resendResetOtp('email', email);
      setOtp('');
      startCooldown();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to resend OTP.'));
    } finally {
      setResending(false);
    }
  };

  const mmss = `${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />
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
          <AuthTopBack onPress={() => navigation.goBack()} disabled={loading} />

          <AuthHeader title="Reset password" subtitle="Enter the 6-digit code sent to your email" />

          <AuthBadge icon={Mail} />

          {/* Address shown in full, not masked — the user just typed it on the
              previous screen, so masking hides nothing and only makes a typo
              harder to spot. */}
          <View style={styles.sentTo}>
            <Text style={styles.sentLabel}>We've sent a 6-digit code to</Text>
            <Text style={styles.sentEmail}>{email}</Text>
          </View>

          <OtpInput value={otp} onChangeOtp={setOtp} error={!!error} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            title="Verify Code"
            onPress={handleVerify}
            variant="primary"
            loading={loading}
            disabled={loading || otp.length !== 6}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || resending}>
              <Text
                style={[
                  styles.resendAction,
                  (resendCooldown > 0 || resending) && { color: palette.muted },
                ]}
              >
                {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${mmss}` : 'Resend'}
              </Text>
            </TouchableOpacity>
          </View>

          <AuthBackLink
            label="Back to sign in"
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

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
    sentTo: {
      alignItems: 'center',
      gap: 5,
    },
    sentLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },
    sentEmail: {
      fontFamily: 'Inter-Bold',
      fontSize: 14.5,
      color: theme.palette.onBackground,
    },
    error: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.palette.error,
      textAlign: 'center',
    },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resendLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 13.5,
      color: theme.palette.muted,
    },
    resendAction: {
      fontFamily: 'Inter-Bold',
      fontSize: 13.5,
      color: theme.colors.secondary,
    },
  });
}

export default ForgotPasswordOtpScreen;
