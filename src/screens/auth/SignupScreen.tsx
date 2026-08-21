import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { Mail, User, CircleCheck, Lock as LockIcon, UserRoundSearch } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import PasswordInput from '../../components/forms/PasswordInput';
import AppButton from '../../components/common/AppButton';
import { useToast } from '../../hooks/useToast';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import BrandMark from '../../components/auth/BrandMark';
import AuthHeader from '../../components/auth/AuthHeader';
import OtpSheet from '../../components/auth/OtpSheet';
import PasswordRuleDots from '../../components/auth/PasswordRuleDots';
import SignupStepper from '../../components/auth/SignupStepper';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { getPersonService } from '../../backend/person/provider/person.provider';
import { extractErrorMessage } from '../../backend/shared/http/axiosError';
import { useSignupDraft } from '../../context/SignupDraftContext';
import { CLAIM_ACCOUNT_ENABLED } from '../../config/features';
import { validateEmail, validateUsername, validatePassword } from '../../utils/validators';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

type Errors = Partial<Record<'email' | 'username' | 'password' | 'confirmPassword', string>>;

// ─── Component ───────────────────────────────────────────────────────────────

// Mockups 02 / 03 / 04 — one screen for the whole credential step.
//
// Replaces the old SignupEmail → OtpVerification → SignupCredentials trio. The
// gating rule is what makes a single screen work: username, password and
// confirm stay locked until the emailed code is confirmed, so the user is never
// looking at four fields they cannot use. The OTP itself is a sheet, not a
// route, so the form stays visible behind it.

const SignupScreen: React.FC<Props> = ({ navigation, route }) => {
  // Entered via "Claim account" rather than "Sign up". Same screen either way —
  // only the copy and the submit label change, exactly as on the web.
  const [claimMode, setClaimMode] = useState(route.params?.claim === true);
  const [email, setEmail] = useState(route.params?.prefillEmail ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailVerified, setEmailVerified] = useState(false);
  // Durable OTP proof from the verify step, carried into the draft at submit so
  // signup validates against the ~30-min token, not the 10-min Redis flag.
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const [errors, setErrors] = useState<Errors>({});

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const { showToast } = useToast();
  const { setDraft, setClaim, clearClaim } = useSignupDraft();
  const authService = getAuthService();
  const personService = getPersonService();
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const clearError = (key: keyof Errors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  // ── Email + OTP ────────────────────────────────────────────────────────────

  const handleVerifyEmail = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, email: 'Email is required' }));
      return;
    }
    if (!validateEmail(trimmed)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email' }));
      return;
    }

    setSendingOtp(true);
    setErrors((prev) => ({ ...prev, email: undefined }));
    try {
      await authService.requestOtp('email', trimmed);
      setOtpError('');
      setOtpVisible(true);
    } catch (err: any) {
      // Every failure on this screen is shown to someone with no account, so all four catches read
      // through the gate. `auth-service`'s catch-all answers a 500 with
      // `"Internal server error: " + ex.getMessage()` in both wrapper fields, which is a raw
      // Postgres or JVM line under a sentence-shaped prefix; `handleApiError` attaches that body to
      // the throw, and the extractor is the thing that refuses it and substitutes the fallback
      // below. Nothing on this screen branches on the thrown text — the OTP wording that IS routing
      // is read later, by `isVerificationError` over `completeSignup`'s own gated string — so here
      // display is the only job.
      setErrors((prev) => ({
        ...prev,
        email: extractErrorMessage(err, 'Failed to send the code.'),
      }));
    } finally {
      if (mountedRef.current) setSendingOtp(false);
    }
  }, [email, authService]);

  const handleVerifyOtp = useCallback(
    async (otp: string) => {
      setVerifyingOtp(true);
      setOtpError('');
      try {
        const result = await authService.verifyOtp('email', email.trim(), otp);
        if (!result.verified) {
          setOtpError('Invalid OTP. Please try again.');
          return;
        }
        // Keep the durable proof for the signup call at the end of the flow.
        setVerificationToken(result.verificationToken);

        // ── Decide-first triage ──────────────────────────────────────────────
        // Before anything is created, work out which of three futures this
        // verified email has. Each outcome is announced only by a toast; none
        // of them gets a screen of its own.
        const verifiedEmail = email.trim();
        let outcome: 'login' | 'claim' | 'signup' = 'signup';
        let matchedPerson: Awaited<ReturnType<typeof personService.findPersonByEmail>> = null;

        const hasLogin = await authService.emailHasAccount(verifiedEmail);
        if (hasLogin) {
          outcome = 'login';
        } else if (CLAIM_ACCOUNT_ENABLED) {
          matchedPerson = await personService.findPersonByEmail(verifiedEmail);
          if (matchedPerson) outcome = 'claim';
        }

        setOtpVisible(false);

        if (outcome === 'login') {
          // Already registered — sending them on would collide at signup.
          setEmailVerified(false);
          clearClaim();
          showToast('This email is already registered. Please sign in.', 'info');
          navigation.navigate('Login');
          return;
        }

        if (outcome === 'claim' && matchedPerson) {
          setClaim({
            personId: matchedPerson.id as number,
            firstName: (matchedPerson.firstName as string) || '',
            lastName: (matchedPerson.lastName as string) || '',
            phoneNumber: (matchedPerson.phoneNumber as string) || '',
          });
          setEmailVerified(true);
          setClaimMode(true);
          showToast('We found your existing profile — finish to claim it.', 'success');
          return;
        }

        // Arrived via "Claim account" but nothing matched — drop out of claim
        // mode and let them register normally. The verified email carries over.
        if (claimMode) {
          setClaimMode(false);
          showToast("No existing profile for this email — let's create a new account.", 'info');
        } else {
          showToast('Email verified — you can finish signing up.', 'success');
        }
        clearClaim();
        setEmailVerified(true);
      } catch (err: any) {
        setOtpError(extractErrorMessage(err, 'Could not verify that code.'));
      } finally {
        if (mountedRef.current) setVerifyingOtp(false);
      }
    },
    [email, authService, personService, showToast, navigation, claimMode, setClaim, clearClaim],
  );

  const handleResendOtp = useCallback(async () => {
    try {
      await authService.resendOtp('email', email.trim());
      showToast('A new code is on its way.', 'info');
    } catch (err: any) {
      setOtpError(extractErrorMessage(err, 'Failed to resend the code.'));
    }
  }, [email, authService, showToast]);

  // ── Username ───────────────────────────────────────────────────────────────

  const handleCheckUsername = useCallback(async () => {
    const value = username.trim();
    if (!value) {
      setErrors((prev) => ({ ...prev, username: 'Username is required' }));
      return;
    }
    if (!validateUsername(value)) {
      setErrors((prev) => ({
        ...prev,
        username: 'Use 3–20 letters, numbers or underscores',
      }));
      return;
    }

    setCheckingUsername(true);
    setErrors((prev) => ({ ...prev, username: undefined }));
    try {
      const available = await authService.checkUsername(value);
      setUsernameAvailable(available);
      if (!available) {
        setErrors((prev) => ({ ...prev, username: 'Username is already taken' }));
      }
    } catch (err: any) {
      setUsernameAvailable(null);
      setErrors((prev) => ({
        ...prev,
        username: extractErrorMessage(err, 'Could not check that username.'),
      }));
    } finally {
      if (mountedRef.current) setCheckingUsername(false);
    }
  }, [username, authService]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const next: Errors = {};

    if (!emailVerified) next.email = 'Please verify your email';
    if (!username.trim()) next.username = 'Username is required';
    else if (usernameAvailable !== true) next.username = 'Please check username availability';
    if (!password) next.password = 'Password is required';
    else if (!validatePassword(password)) {
      next.password =
        'Password must have 8+ chars, uppercase, lowercase, number, and special character (@$!%*?&#_-)';
    }
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setDraft({ email: email.trim(), username: username.trim(), password, verificationToken });
    navigation.navigate('ProfilePersonal', { email: email.trim(), username: username.trim() });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const locked = !emailVerified;
  const usernameLocked = locked || usernameAvailable === true;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

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
          <BrandMark />
          <AuthHeader
            title={claimMode ? 'Claim your account' : 'Create account'}
            subtitle={
              claimMode
                ? 'Verify your email to find and claim your existing profile'
                : 'Start your 14-day free trial today'
            }
          />
          <SignupStepper active={0} />

          {claimMode && !emailVerified && (
            <View style={styles.notice}>
              <UserRoundSearch size={17} color={colors.secondary} />
              <Text style={styles.noticeText}>
                Visited us before? If a walk-in profile exists for your email, we'll link it to your
                new login.
              </Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Email — the only field live before verification */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email *</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldGrow}>
                  <AppInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearError('email');
                    }}
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={emailVerified}
                    error={errors.email}
                    leftIcon={<Mail size={18} color={palette.muted} />}
                    rightIcon={
                      emailVerified ? <CircleCheck size={18} color={palette.success} /> : undefined
                    }
                    style={styles.fieldInputFlush}
                  />
                </View>
                <AppButton
                  title={emailVerified ? 'Verified' : 'Verify'}
                  onPress={handleVerifyEmail}
                  variant={emailVerified ? 'secondary' : 'primary'}
                  loading={sendingOtp}
                  disabled={emailVerified || sendingOtp}
                  style={styles.inlineAction}
                />
              </View>
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username *</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldGrow}>
                  <AppInput
                    value={username}
                    onChangeText={(v) => {
                      setUsername(v.replace(/\s/g, ''));
                      setUsernameAvailable(null);
                      clearError('username');
                    }}
                    placeholder="Choose a username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    disabled={usernameLocked}
                    error={errors.username}
                    leftIcon={<User size={18} color={palette.muted} />}
                    rightIcon={
                      usernameAvailable ? (
                        <CircleCheck size={18} color={palette.success} />
                      ) : undefined
                    }
                    style={styles.fieldInputFlush}
                  />
                </View>
                <AppButton
                  title={usernameAvailable ? 'Available' : 'Check'}
                  onPress={handleCheckUsername}
                  variant={usernameAvailable ? 'secondary' : 'primary'}
                  loading={checkingUsername}
                  disabled={usernameLocked || checkingUsername}
                  style={styles.inlineAction}
                />
              </View>
            </View>
            {usernameAvailable && !errors.username ? (
              <Text style={styles.successHint}>Username is available!</Text>
            ) : null}

            {/* Password */}
            <View style={styles.passwordGroup}>
              <PasswordInput
                label="Password *"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
                placeholder="Password"
                error={errors.password}
              />
              <PasswordRuleDots password={password} />
            </View>

            {/* Confirm */}
            <View style={styles.passwordGroup}>
              <PasswordInput
                label="Confirm Password *"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  clearError('confirmPassword');
                }}
                placeholder="Confirm password"
                error={errors.confirmPassword}
              />
              {passwordsMatch && !errors.confirmPassword ? (
                <Text style={styles.successHint}>Passwords match</Text>
              ) : null}
            </View>
          </View>

          {/* Why everything below the email is inert */}
          {locked && (
            <View style={styles.notice}>
              <LockIcon size={17} color={colors.secondary} />
              <Text style={styles.noticeText}>
                Verify your email first — the remaining fields unlock once the 6-digit code is
                confirmed.
              </Text>
            </View>
          )}

          {/* "Continue" on the claim path — no account is being created here,
              the existing profile is being linked at the final step. */}
          <AppButton
            title={claimMode ? 'Continue' : 'Create Account'}
            onPress={handleSubmit}
            variant="primary"
            disabled={locked}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OtpSheet
        visible={otpVisible}
        email={email.trim()}
        verifying={verifyingOtp}
        error={otpError}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onDismiss={() => setOtpVisible(false)}
      />
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
    fieldGroup: {
      gap: 8,
    },
    // Matches AppInput's built-in label so Email/Username read the same as the
    // Password / Confirm labels on this screen.
    fieldLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.palette.onBackground,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    fieldGrow: {
      flex: 1,
    },
    // The input box and the inline button are now true siblings of equal height,
    // so they align top and bottom. AppInput's own label + marginBottom are
    // dropped here (label rendered above the row, marginBottom zeroed) — that
    // baked-in spacing was what pushed the button out of line.
    fieldInputFlush: {
      marginBottom: 0,
    },
    inlineAction: {
      minWidth: 96,
      height: 50,
      paddingHorizontal: 18,
    },
    passwordGroup: {
      gap: 11,
    },
    successHint: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: theme.palette.success,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 13,
      backgroundColor: theme.colors.softBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    noticeText: {
      flex: 1,
      fontFamily: 'Inter-Regular',
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.colors.secondary,
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
    footerLink: {
      fontFamily: 'Inter-Bold',
      fontSize: 14,
      color: theme.colors.secondary,
    },
  });
}

export default SignupScreen;
