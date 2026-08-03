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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotUsernameEmail'>;

// Mockup 08 — enter the address, we email the username back.

const ForgotUsernameEmailScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const authService = getAuthService();

  const handleSend = async () => {
    const trimmed = email.trim();
    setError('');

    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(trimmed)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotUsername(trimmed);
    } catch {
      // Swallowed on purpose. A failure here would otherwise reveal whether the
      // address is registered, which is exactly what screen 09's wording is
      // designed to hide. Genuine outages surface on the next real request.
    } finally {
      setLoading(false);
    }

    navigation.navigate('ForgotUsernameSent', { email: trimmed });
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

          <AuthHeader
            title="Recover username"
            subtitle="Enter your email and we'll send your username"
          />

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
            title="Send My Username"
            onPress={handleSend}
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

export default ForgotUsernameEmailScreen;
