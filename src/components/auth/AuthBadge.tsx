import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// The 76px tinted circle that anchors a single-purpose screen — the mail icon
// on an OTP step, the tick on a confirmation (mockups 06 / 09).

interface AuthBadgeProps {
  icon: LucideIcon;
  tone?: 'accent' | 'success';
}

export function AuthBadge({ icon: Icon, tone = 'accent' }: AuthBadgeProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isSuccess = tone === 'success';

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          isSuccess && {
            backgroundColor: palette.success + '2e',
            borderColor: palette.success + '59',
          },
        ]}
      >
        <Icon size={34} color={isSuccess ? palette.success : colors.primary} />
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
    },
    badge: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
}

export default AuthBadge;
