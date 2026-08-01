import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Mail } from 'lucide-react-native';
import { OtpInput } from '../forms/OtpInput';
import AppButton from '../common/AppButton';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Mockup 03 — the email verification step, presented as a bottom sheet over the
// signup form rather than as its own route, so the user never loses sight of
// what they were filling in.
//
// Implemented with RN's Modal instead of @gorhom/bottom-sheet: the auth stack
// has no BottomSheetModalProvider, and this sheet is static height with no
// snap points or drag-to-dismiss, so the dependency would buy nothing.

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpSheetProps {
  visible: boolean;
  email: string;
  verifying?: boolean;
  error?: string;
  onVerify: (otp: string) => void;
  onResend: () => Promise<void> | void;
  onDismiss: () => void;
}

export function OtpSheet({
  visible,
  email,
  verifying = false,
  error,
  onVerify,
  onResend,
  onDismiss,
}: OtpSheetProps) {
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Restart the cooldown each time the sheet opens — a fresh code was just sent.
  useEffect(() => {
    if (visible) {
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setResending(false);
    }
  }, [cooldown, resending, onResend]);

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={styles.scrim} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.badge}>
              <Mail size={34} color={colors.primary} />
            </View>

            <View style={styles.headerBlock}>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.sentLabel}>We've sent a 6-digit code to</Text>
              <Text style={styles.sentEmail}>{email}</Text>
            </View>

            <OtpInput value={otp} onChangeOtp={setOtp} error={!!error} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AppButton
              title="Verify OTP"
              onPress={() => onVerify(otp)}
              variant="primary"
              loading={verifying}
              disabled={otp.length !== 6 || verifying}
            />

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive the code? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0 || resending || verifying}
              >
                <Text
                  style={[
                    styles.resendAction,
                    (cooldown > 0 || resending) && { color: palette.muted },
                  ]}
                >
                  {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${mmss}` : 'Resend'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // Centered over the scrim (was a bottom sheet) so the code inputs sit around
    // the vertical middle, above the keyboard, and are never hidden by it.
    root: {
      flex: 1,
      justifyContent: 'center',
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#020617c4',
    },
    kav: {
      paddingHorizontal: 20,
    },
    sheet: {
      backgroundColor: theme.palette.surfaceElevated,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      paddingHorizontal: 22,
      paddingVertical: 26,
      gap: 20,
      alignItems: 'stretch',
    },
    badge: {
      alignSelf: 'center',
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerBlock: {
      alignItems: 'center',
      gap: 5,
    },
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 22,
      color: theme.palette.onBackground,
      marginBottom: 3,
    },
    sentLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: theme.palette.muted,
    },
    sentEmail: {
      fontFamily: 'Inter-Bold',
      fontSize: 14.5,
      color: theme.palette.onBackground,
    },
    error: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.palette.error,
      textAlign: 'center',
    },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resendLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 13.5,
      color: theme.palette.muted,
    },
    resendAction: {
      fontFamily: 'Inter-Bold',
      fontSize: 13.5,
      color: theme.colors.secondary,
    },
  });
}

export default OtpSheet;
