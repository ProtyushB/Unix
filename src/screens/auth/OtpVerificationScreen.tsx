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
import StepProgress from '../../components/common/StepProgress';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerification'>;

const RESEND_COOLDOWN = 60;

// ─── Component ───────────────────────────────────────────────────────────────

const OtpVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params.email);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync email + reset OTP if user comes back after editing it
  useEffect(() => {
    if (route.params.email && route.params.email !== email) {
      setEmail(route.params.email);
      setOtp('');
      setError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.email]);

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
      const isValid = await authService.verifyOtp('email', email, otp);
      if (isValid) {
        navigation.navigate('SignupCredentials', { email });
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
      await authService.resendOtp('email', email);
      startCooldown();
    } catch (err: any) {
      const message = err?.message || 'Failed to resend OTP.';
      setError(message);
    } finally {
      setResending(false);
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
          scrollEnabled={false}
        >
          <StepProgress
            currentStep={2}
            totalSteps={5}
            onStepPress={(step) => {
              // DEV ONLY: remove before production
              const DEV_EMAIL = email;
              const DEV_USER = 'devuser';
              const DEV_PASS = 'Dev@12345';
              if (step === 1) navigation.navigate('SignupEmail');
              else if (step === 3) navigation.navigate('SignupCredentials', { email: DEV_EMAIL });
              else if (step === 4) navigation.navigate('ProfilePersonal', { email: DEV_EMAIL, username: DEV_USER, password: DEV_PASS });
              else if (step === 5) navigation.navigate('ProfileBusiness', { email: DEV_EMAIL, username: DEV_USER, password: DEV_PASS, firstName: 'Dev', lastName: 'User', phoneNumber: '9999999999' });
            }}
          />

          <View>
            {/* Title */}
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to
            </Text>
            <View style={styles.emailRow}>
              <Text style={styles.emailText}>{email}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SignupEmail', { prefillEmail: email })}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.editHint}>
              Wrong email? Tap Edit to go back and correct it.
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
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 4,
    lineHeight: 22,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  emailText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#f8fafc',
    flexShrink: 1,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#f9731620',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f9731640',
  },
  editButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#f97316',
  },
  editHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#64748b',
    marginBottom: 28,
    lineHeight: 18,
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
    marginBottom: 24,
  },

  // Button
  buttonContainer: {
    marginTop: 12,
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

export default OtpVerificationScreen;
