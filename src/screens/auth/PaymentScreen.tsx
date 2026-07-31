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
import { CreditCard } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useToast } from '../../hooks/useToast';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import PaymentStep from '../../components/auth/PaymentStep';
import { useSignupDraft } from '../../context/SignupDraftContext';
import { useAppContext } from '../../context/AppContext';
import { completeSignup } from '../../services/completeSignup';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Payment'>;

// Mockups 14 / 14b / 14c / 14d — the business-only ending of signup.
//
// The account is created HERE, not on the review screen, because the employee
// and coupon codes have to be stamped onto every business as it is inserted.
// Payment itself is manual and out-of-band: businesses are created with
// isPaymentVerified=false and an admin flips them on after confirming payment,
// so the user lands on the portal immediately with the business pending.

const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personal, businesses } = route.params;
  const { getDraft, getClaim, clearDraft, clearClaim } = useSignupDraft();

  const [submitting, setSubmitting] = useState(false);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const { showToast } = useToast();
  const { hydrateSelection } = useAppContext();

  const handleConfirm = async ({
    employeeCode,
    couponCode,
  }: {
    employeeCode: string;
    couponCode: string | null;
  }) => {
    const draft = getDraft();
    if (!draft) {
      showToast('Please go back and re-enter your credentials.', 'error', {
        title: 'Session expired',
      });
      return;
    }

    setSubmitting(true);
    const result = await completeSignup({
      personal,
      businesses,
      password: draft.password,
      claim: getClaim(),
      verificationToken: draft.verificationToken,
      employeeCode,
      couponCode,
    });

    if (result.ok) {
      clearDraft();
      clearClaim();
      // completeSignup has just written the business map; AppContext hydrated before it existed.
      await hydrateSelection();
      navigation.reset({ index: 0, routes: [{ name: 'PortalSelection' }] });
      return;
    }

    // State 14b — the OTP proof lapsed mid-signup. Don't strand the user on a
    // dead-end banner: the draft survives, so send them back to re-verify and
    // they pick up where they left off.
    if (result.verificationExpired) {
      showToast('Taking you back to verify your email again…', 'warning', {
        title: 'Verification expired',
      });
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Signup', params: { prefillEmail: personal.email } }],
        });
      }, 2500);
      return;
    }

    setSubmitting(false);
    // Rollback has already run — the codes stay filled and the user can retry.
    showToast(result.error, 'error', { title: "Couldn't complete signup" });
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
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <CreditCard size={27} color={colors.primary} />
              <Text style={styles.title}>Complete payment</Text>
            </View>
            <Text style={styles.subtitle}>
              Pay via the QR and enter your codes to finish registration
            </Text>
          </View>

          <PaymentStep
            onConfirm={handleConfirm}
            onBack={() => navigation.goBack()}
            submitting={submitting}
            confirmLabel="Confirm & Create Account"
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
    header: {
      gap: 9,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 26,
      color: theme.palette.onBackground,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 14.5,
      lineHeight: 21,
      color: theme.palette.muted,
    },
  });
}

export default PaymentScreen;
