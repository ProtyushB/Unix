import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { QrCode, IdCard, Ticket } from 'lucide-react-native';
import { AppInput } from '../common/AppInput';
import AppButton from '../common/AppButton';
import { FileService } from '../../backend/dms/service/file.service';
import { PAYMENT_QR_FILE_ID } from '../../config/features';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Mockup 14 — the manual payment step.
//
// Presentational: it owns the two codes and their validation, then hands them
// up. It never verifies a payment — payment is out-of-band, the business is
// created gated off, and an admin flips it on later.

interface PaymentStepProps {
  onConfirm: (codes: { employeeCode: string; couponCode: string | null }) => void;
  onBack: () => void;
  submitting?: boolean;
  confirmLabel?: string;
}

export function PaymentStep({
  onConfirm,
  onBack,
  submitting = false,
  confirmLabel = 'Confirm',
}: PaymentStepProps) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [localError, setLocalError] = useState('');

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Served without auth — the user has no token at this point in signup.
  const qrUri =
    PAYMENT_QR_FILE_ID > 0 ? new FileService().getResourceUrl(PAYMENT_QR_FILE_ID) : null;

  const handleConfirm = () => {
    if (submitting) return;
    if (!employeeCode.trim()) {
      // State 14d — client-side only, never reaches the network.
      setLocalError('Employee code is required.');
      return;
    }
    setLocalError('');
    onConfirm({
      employeeCode: employeeCode.trim(),
      couponCode: couponCode.trim() || null,
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.qrBlock}>
        <Text style={styles.qrCaption}>Scan the QR to pay, then enter the codes below</Text>
        <View style={styles.qrStage}>
          {qrUri ? (
            <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <View style={styles.qrFallback}>
              <QrCode size={40} color={palette.muted} />
              <Text style={styles.qrFallbackText}>
                Payment QR not configured yet. Set PAYMENT_QR_FILE_ID.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.form}>
        <AppInput
          label="Employee Code *"
          value={employeeCode}
          onChangeText={(v) => {
            setEmployeeCode(v);
            if (localError) setLocalError('');
          }}
          placeholder="Your sales rep's employee code"
          autoCapitalize="characters"
          autoCorrect={false}
          disabled={submitting}
          error={localError || undefined}
          leftIcon={<IdCard size={18} color={palette.muted} />}
        />

        <AppInput
          label="Coupon Code (optional)"
          value={couponCode}
          onChangeText={setCouponCode}
          placeholder="Enter a coupon code if you have one"
          autoCapitalize="characters"
          autoCorrect={false}
          disabled={submitting}
          leftIcon={<Ticket size={18} color={palette.muted} />}
        />
      </View>

      <Text style={styles.footnote}>
        Payment is verified manually. Your business is created right away and activated once we
        confirm your payment.
      </Text>

      <View style={styles.actions}>
        <AppButton
          title={submitting ? 'Processing...' : confirmLabel}
          onPress={handleConfirm}
          variant="primary"
          loading={submitting}
          disabled={submitting}
        />
        <AppButton title="Back" onPress={onBack} variant="secondary" disabled={submitting} />
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      gap: 26,
    },
    qrBlock: {
      alignItems: 'center',
      gap: 14,
    },
    qrCaption: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      color: theme.palette.muted,
      textAlign: 'center',
    },
    qrStage: {
      padding: 14,
      borderRadius: 20,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    qrImage: {
      width: 196,
      height: 196,
      borderRadius: 12,
      backgroundColor: '#ffffff',
    },
    qrFallback: {
      width: 196,
      height: 196,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.palette.surfaceElevated,
    },
    qrFallbackText: {
      fontFamily: 'Inter-Regular',
      fontSize: 11.5,
      lineHeight: 17,
      color: theme.palette.muted,
      textAlign: 'center',
    },
    form: {
      gap: 18,
    },
    footnote: {
      fontFamily: 'Inter-Regular',
      fontSize: 11.5,
      lineHeight: 17,
      color: theme.palette.muted,
      textAlign: 'center',
    },
    actions: {
      gap: 12,
    },
  });
}

export default PaymentStep;
