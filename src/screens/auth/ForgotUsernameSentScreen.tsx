import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../../components/common/AppButton';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthTopBack from '../../components/auth/AuthTopBack';
import AuthBadge from '../../components/auth/AuthBadge';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotUsernameSent'>;

// Mockup 09 — the confirmation.
//
// The wording is conditional ("If an account is registered to…") and is shown
// unchanged whether or not the address exists. That is the whole point: a
// definite "sent!" would confirm the address is registered and turn this screen
// into an account-enumeration oracle. Do not "improve" this copy.

const ForgotUsernameSentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />
      <ScrollView
        removeClippedSubviews={false}
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, scrollInsets]}
        showsVerticalScrollIndicator={false}
      >
        <AuthTopBack onPress={() => navigation.goBack()} />

        <AuthHeader
          title="Recover username"
          subtitle="Check your inbox for your username"
        />

        <AuthBadge icon={CircleCheck} tone="success" />

        <View style={styles.message}>
          <Text style={styles.line}>If an account is registered to</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.line}>we've emailed the username to it.</Text>
        </View>

        <AppButton
          title="Back to sign in"
          onPress={() => navigation.navigate('Login')}
          variant="primary"
        />
      </ScrollView>
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
    message: {
      alignItems: 'center',
      gap: 5,
    },
    line: {
      fontFamily: 'Inter-Regular',
      fontSize: 14.5,
      color: theme.palette.muted,
      textAlign: 'center',
    },
    email: {
      fontFamily: 'Inter-Bold',
      fontSize: 15,
      color: theme.palette.onBackground,
      textAlign: 'center',
    },
  });
}

export default ForgotUsernameSentScreen;
