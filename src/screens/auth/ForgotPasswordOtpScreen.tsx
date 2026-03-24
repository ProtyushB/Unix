import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import OtpInput from '../../components/forms/OtpInput';
import AppButton from '../../components/common/AppButton';
import { getAuthService } from '../../backend/auth/provider/auth.provider';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

const RESEND_COOLDOWN = 60;

// ─── Component ───────────────────────────────────────────────────────────────

const ForgotPasswordOtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authService = getAuthService();

  // Start countdown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setResendCooldown(prev => {
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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
      const message = err?.message || 'Verification failed. Please try again.';
      setError(message);
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
      startCooldown();
    } catch (err: any) {
      const message = err?.message || 'Failed to resend OTP.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  // Mask email: jo***@example.com
  const maskedEmail = (() => {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 5))}@${domain}`;
  })();

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
          {/* Title */}
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{' '}
            <Text style={styles.emailHighlight}>{maskedEmail}</Text>
          </Text>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <OtpInput
              length={6}
              value={otp}
              onChangeOtp={setOtp}
            />
          </View>

          {/* Verify Button */}
          <View style={styles.buttonContainer}>
            <AppButton
              title="Verify"
              onPress={handleVerify}
              variant="primary"
              loading={loading}
              disabled={loading || otp.length !== 6}
            />
          </View>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0 || resending}
            >
              <Text
                style={[
                  styles.resendLink,
                  (resendCooldown > 0 || resending) && styles.resendDisabled,
                ]}
              >
                {resending
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend OTP (${resendCooldown}s)`
                    : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
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

  // Title
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: 'Inter-Medium',
    color: '#f97316',
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

  // OTP
  otpContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },

  // Button
  buttonContainer: {
    marginTop: 8,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  resendLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#94a3b8',
  },
  resendLink: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#f97316',
  },
  resendDisabled: {
    color: '#64748b',
  },
});

export default ForgotPasswordOtpScreen;
