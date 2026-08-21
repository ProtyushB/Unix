import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PasswordInput from '../../components/forms/PasswordInput';
import AppButton from '../../components/common/AppButton';
import { useToast } from '../../hooks/useToast';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthTopBack from '../../components/auth/AuthTopBack';
import AuthBackLink from '../../components/auth/AuthBackLink';
import PasswordRuleDots from '../../components/auth/PasswordRuleDots';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { extractErrorMessage } from '../../backend/shared/http/axiosError';
import { PASSWORD_RULES } from '../../utils/validators';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordNew'>;

// Mockup 07 — step three of three, including the mismatch error state.

const ForgotPasswordNewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const { showToast } = useToast();
  const authService = getAuthService();

  const allPasswordRulesPass = PASSWORD_RULES.every((rule) => rule.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = allPasswordRulesPass && passwordsMatch;

  // Only complain about a mismatch once there is something to compare against —
  // flagging it on the first keystroke of the confirm field is just noise.
  const mismatchError =
    touchedConfirm && confirmPassword.length > 0 && !passwordsMatch
      ? 'Passwords do not match'
      : undefined;

  const handleReset = async () => {
    setError('');
    if (!isFormValid) {
      setTouchedConfirm(true);
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(email, newPassword);
      showToast('Password reset successful! Please sign in with your new password.', 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err: any) {
      // Two jobs that used to share one variable. `err.message` is the raw thrown text and stays
      // the ROUTING input, matched exactly as before; what reaches the screen is the gated value,
      // because this screen is reachable without an account and `auth-service`'s catch-all puts
      // `"Internal server error: " + ex.getMessage()` — a Postgres `ERROR:` line, table name and
      // all — into the very field the else branch used to render.
      //
      // The old code branched on `message`, which had the fallback `||`'d into it, so an error with
      // no message at all was matched against "Failed to reset password." rather than against
      // nothing. Reading `err?.message` directly is both the correct input and the shape
      // `LoginScreen` already uses.
      //
      // One key, because one key fires. auth-service throws "New password cannot be the same as the
      // old password" (AuthServiceImpl.resetPassword) and nothing else for a reuse.
      //
      // This branch shipped with three others — 'same password', 'previously used', 'must be
      // different' — and matched on none of them, because "same AS THE OLD password" breaks the
      // first and no backend emits the rest. So every reuse attempt fell to the else and the user
      // was told only that the reset failed. They are deleted rather than kept as a hedge: three
      // conditions that match nothing still read as coverage, and a branch that LOOKED covered is
      // the whole reason this went unnoticed. The test named 'would not have matched on the keys
      // the screen originally shipped with' holds that history, so deleting them costs no memory.
      const raw = (err?.message || '').toLowerCase();
      if (raw.includes('same as the old password')) {
        setError('New password must be different from your current password.');
      } else {
        setError(extractErrorMessage(err, 'Failed to reset password.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />{' '}
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

          <AuthHeader title="Reset password" subtitle="Choose a new password for your account" />

          <View style={styles.verifiedNote}>
            <CircleCheck size={17} color={palette.success} />
            <Text style={styles.verifiedText}>Email verified. Set your new password below.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.passwordGroup}>
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter a new password"
              />
              <PasswordRuleDots password={newPassword} />
            </View>

            <View style={styles.passwordGroup}>
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setTouchedConfirm(true);
                }}
                placeholder="Re-enter the new password"
                error={mismatchError}
              />
              {passwordsMatch ? <Text style={styles.matchText}>Passwords match</Text> : null}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            title="Reset Password"
            onPress={handleReset}
            variant="primary"
            loading={loading}
            disabled={loading || !isFormValid}
          />

          <AuthBackLink label="Back" onPress={() => navigation.goBack()} disabled={loading} />
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
    verifiedNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 13,
      backgroundColor: theme.palette.success + '2e',
      borderWidth: 1,
      borderColor: theme.palette.success + '40',
    },
    verifiedText: {
      flex: 1,
      fontFamily: 'Inter-Regular',
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.palette.success,
    },
    form: {
      gap: 18,
    },
    passwordGroup: {
      gap: 11,
    },
    matchText: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: theme.palette.success,
    },
    error: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.palette.error,
      textAlign: 'center',
    },
  });
}

export default ForgotPasswordNewScreen;
