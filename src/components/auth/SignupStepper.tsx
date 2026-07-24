import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// The Account · Profile · Preview pills from mockups 02 / 04 / 11 / 13.
//
// Named rather than numbered (unlike the shared StepProgress) because the value
// here is telling a first-time user what is still ahead of them — a bare "2 of
// 3" does not. Payment is intentionally absent: it only applies to business
// signups, so showing it to everyone would overstate the work for a customer.

const STEPS = ['Account', 'Profile', 'Preview'] as const;

interface SignupStepperProps {
  /** Zero-based index of the current step. */
  active: number;
}

export function SignupStepper({ active }: SignupStepperProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <View key={label} style={[styles.pill, isActive && styles.pillActive]}>
            {isDone ? (
              <Check size={12} color={palette.success} />
            ) : (
              <Text style={[styles.num, isActive && styles.numActive]}>{i + 1}</Text>
            )}
            <Text
              style={[
                styles.label,
                isDone && { color: palette.onSurface },
                isActive && { color: colors.secondary, fontFamily: 'Inter-Bold' },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pill: {
      flex: 1,
      height: 30,
      borderRadius: 15,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    pillActive: {
      backgroundColor: theme.colors.softBg,
      borderColor: theme.colors.border,
    },
    num: {
      fontFamily: 'Inter-Bold',
      fontSize: 11,
      color: theme.palette.muted,
    },
    numActive: {
      color: theme.colors.secondary,
    },
    label: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: theme.palette.muted,
    },
  });
}

export default SignupStepper;
