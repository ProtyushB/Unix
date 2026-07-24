import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { User, Building2, Pencil, CircleCheck, X } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../../components/common/AppButton';
import { Toast } from '../../components/common/Toast';
import { useToast } from '../../hooks/useToast';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import SignupStepper from '../../components/auth/SignupStepper';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import { useSignupDraft } from '../../context/SignupDraftContext';
import { completeSignup } from '../../services/completeSignup';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Review'>;

// Mockups 13 / 13c / 13d.
//
// This is where the two paths diverge, and the difference is easy to miss:
//   · customer-only — "Save & Continue" creates the account right here
//   · with a business — "Continue to Payment" only NAVIGATES; the payment step
//     does the creating, because the employee/coupon codes have to be stamped
//     onto every business at insert time.
// So the spinner and the error banner on this screen are reachable on the
// customer path only. On the business path the button cannot fail.

const ReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personal, businesses } = route.params;
  const { getDraft, getClaim, clearDraft, clearClaim } = useSignupDraft();
  const [saving, setSaving] = useState(false);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();
  const { toasts, showToast, dismissToast } = useToast();

  const hasBusiness = businesses && businesses.length > 0;

  const handleSave = async () => {
    const draft = getDraft();
    if (!draft) {
      showToast('Please go back and re-enter your credentials.', 'error', {
        title: 'Session expired',
      });
      return;
    }

    setSaving(true);
    const result = await completeSignup({
      personal,
      businesses,
      password: draft.password,
      claim: getClaim(),
      verificationToken: draft.verificationToken,
    });
    setSaving(false);

    if (!result.ok) {
      // Rollback has already run, so the form is intact — the user can retry.
      showToast(result.error, 'error', { title: "Couldn't create profile" });
      return;
    }

    clearDraft();
    clearClaim();
    navigation.reset({ index: 0, routes: [{ name: 'PortalSelection' }] });
  };

  const handlePrimary = () => {
    if (hasBusiness) {
      navigation.navigate('Payment', { personal, businesses });
      return;
    }
    handleSave();
  };

  const kv = (label: string, value: string, verified = false) => (
    <View style={styles.kv} key={label}>
      <Text style={styles.kvLabel}>{label}</Text>
      <View style={styles.kvValueRow}>
        <Text style={styles.kvValue}>{value}</Text>
        {verified && <CircleCheck size={15} color={palette.success} />}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <ScrollView
        removeClippedSubviews={false}
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, scrollInsets]}
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader
          title="Review your information"
          subtitle="Please verify all details before submitting"
        />
        <SignupStepper active={2} />

        <View style={[styles.body, saving && styles.dimmed]} pointerEvents={saving ? 'none' : 'auto'}>
          {/* Personal */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <User size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Personal Information</Text>
              </View>
              <TouchableOpacity style={styles.editRow} onPress={() => navigation.goBack()}>
                <Pencil size={14} color={colors.secondary} />
                <Text style={styles.editLabel}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.kvRow}>
              {kv('First Name', personal.firstName)}
              {kv('Last Name', personal.lastName)}
            </View>
            <View style={styles.kvRow}>
              {kv('Username', personal.username, true)}
              {kv('Email', personal.email, true)}
            </View>
            <View style={styles.kvRow}>
              {kv('Phone Number', personal.phoneNumber)}
              {kv('Password', '••••••••')}
            </View>
          </View>

          {/* Business */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Building2 size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Business Information</Text>
              </View>
              {hasBusiness && (
                <TouchableOpacity style={styles.editRow} onPress={() => navigation.goBack()}>
                  <Pencil size={14} color={colors.secondary} />
                  <Text style={styles.editLabel}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {hasBusiness ? (
              businesses.map((biz: any, index: number) => (
                <View key={index} style={styles.bizCard}>
                  <View style={styles.cardTitleRow}>
                    <Building2 size={17} color={colors.primary} />
                    <Text style={styles.bizTitle}>Business {index + 1}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    {kv('Business Name', biz.businessName)}
                    {kv('Business Type', getBusinessTypeLabel(biz.businessType))}
                  </View>
                  <View style={styles.kvRow}>
                    {kv('Phone', biz.businessPhone || '—')}
                    {kv('Email', biz.businessEmail || '—')}
                  </View>
                  {(biz.gstin || biz.pan) && (
                    <View style={styles.kvRow}>
                      {kv('GSTIN', biz.gstin || '—')}
                      {kv('PAN', biz.pan || '—')}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyBusiness}>No business information provided</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="secondary"
            disabled={saving}
            style={styles.cancelButton}
            leftIcon={<X size={18} color={palette.onSurface} />}
          />
          <AppButton
            title={saving ? 'Saving...' : hasBusiness ? 'Continue to Payment' : 'Save & Continue'}
            onPress={handlePrimary}
            variant="primary"
            loading={saving}
            disabled={saving}
            style={styles.primaryButton}
          />
        </View>
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
    body: {
      gap: 26,
    },
    dimmed: {
      opacity: 0.5,
    },

    card: {
      gap: 16,
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    cardTitle: {
      fontFamily: 'Inter-Bold',
      fontSize: 17,
      color: theme.palette.onBackground,
    },
    editRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    editLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      color: theme.colors.secondary,
    },

    kvRow: {
      flexDirection: 'row',
      gap: 14,
    },
    kv: {
      flex: 1,
      gap: 3,
    },
    kvLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 11.5,
      color: theme.palette.muted,
    },
    kvValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    kvValue: {
      flexShrink: 1,
      fontFamily: 'Inter-SemiBold',
      fontSize: 14.5,
      color: theme.palette.onBackground,
    },

    bizCard: {
      gap: 14,
      padding: 15,
      borderRadius: 14,
      backgroundColor: theme.palette.background + '59',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    bizTitle: {
      fontFamily: 'Inter-Bold',
      fontSize: 15,
      color: theme.palette.onBackground,
    },
    emptyBusiness: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },

    actions: {
      flexDirection: 'row',
      gap: 13,
    },
    cancelButton: {
      width: 118,
    },
    primaryButton: {
      flex: 1,
    },
  });
}

export default ReviewScreen;
