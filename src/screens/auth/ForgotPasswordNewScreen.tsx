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
import { ShieldCheck } from 'lucide-react-native';
import PasswordInput from '../../components/forms/PasswordInput';
import PasswordChecklist from '../../components/forms/PasswordChecklist';
import PasswordMatch from '../../components/forms/PasswordMatch';
import AppButton from '../../components/common/AppButton';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { useToast } from '../../hooks/useToast';
import { PASSWORD_RULES } from '../../utils/validators';

// ─── Param List ──────────────────────────────────────────────────────────────

type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: undefined;
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={32} color="#f97316" strokeWidth={1.5} />
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

  // Icon
  iconContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#f9731615',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f9731630',
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

  // Spacing
  fieldSpacer: {
    height: 8,
  },

  // Button
  buttonContainer: {
    marginTop: 24,
  },
});

export default ForgotPasswordNewScreen;
