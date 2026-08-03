import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Mail } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthTopBack from '../../components/auth/AuthTopBack';
import AuthBackLink from '../../components/auth/AuthBackLink';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { validateEmail } from '../../utils/validators';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordEmail'>;

// Mockup 05 — step one of three.

const ForgotPasswordEmailScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const authService = getAuthService();

  const handleSendOtp = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await authService.requestResetPasswordOtp('email', trimmedEmail);
      navigation.navigate('ForgotPasswordOtp', { email: trimmedEmail });
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

          <AuthHeader title="Reset password" subtitle="Enter your email to receive a reset code" />

          <AppInput
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError('');
            }}
            placeholder="Enter your registered email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
            leftIcon={<Mail size={18} color={palette.muted} />}
          />

          <AppButton
            title="Send Reset Code"
            onPress={handleSendOtp}
            variant="primary"
            loading={loading}
            disabled={loading}
          />

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
  });
}

export default ForgotPasswordEmailScreen;
