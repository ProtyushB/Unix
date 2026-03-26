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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PasswordInput from '../../components/forms/PasswordInput';
import PasswordChecklist from '../../components/forms/PasswordChecklist';
import PasswordMatch from '../../components/forms/PasswordMatch';
import AppButton from '../../components/common/AppButton';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { useToast } from '../../hooks/useToast';
import { PASSWORD_RULES } from '../../utils/validators';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordNew'>;

// ─── Component ───────────────────────────────────────────────────────────────

const ForgotPasswordNewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const authService = getAuthService();

  const allPasswordRulesPass = PASSWORD_RULES.every(rule => rule.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = allPasswordRulesPass && passwordsMatch;

  const handleReset = async () => {
    setError('');

    if (!isFormValid) return;

    setLoading(true);
    try {
      await authService.resetPassword(email, newPassword);

      showToast('Password reset successful! Please log in with your new password.', 'success');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err: any) {
      const message = err?.message || 'Failed to reset password.';

      // Check for "same password" error
      if (
        message.toLowerCase().includes('same password') ||
        message.toLowerCase().includes('previously used') ||
        message.toLowerCase().includes('must be different')
      ) {
        setError('New password must be different from your current password.');
      } else {
        setError(message);
      }
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
              <Text style={{ fontSize: 32 }}>🛡️</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            Create a strong new password for your account
          </Text>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* New Password */}
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChangeText={(val) => {
              setNewPassword(val);
              if (error) setError('');
            }}
            placeholder="Enter new password"
          />
          <PasswordChecklist password={newPassword} />

          {/* Confirm Password */}
          <View style={styles.fieldSpacer} />
          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              if (error) setError('');
            }}
            placeholder="Re-enter new password"
          />
          {confirmPassword.length > 0 && (
            <PasswordMatch match={passwordsMatch} />
          )}

          {/* Reset Button */}
          <View style={styles.buttonContainer}>
            <AppButton
              title="Reset Password"
              onPress={handleReset}
              variant="primary"
              loading={loading}
              disabled={!isFormValid || loading}
            />
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

export default ForgotPasswordNewScreen;
