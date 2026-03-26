import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PASSWORD_RULES } from '../../utils/validators';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PasswordChecklistProps {
  password: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {PASSWORD_RULES.map((rule, index) => {
        const passes = rule.test(password);
        return (
          <View key={index} style={styles.row}>
            {passes ? (
              <Text style={styles.iconPass}>✓</Text>
            ) : (
              <Text style={styles.iconPending}>○</Text>
            )}
            <Text style={[styles.label, passes && styles.labelPassing]}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 8,
      marginTop: 8,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconPass: {
      fontSize: 14,
      color: theme.palette.success,
    },
    iconPending: {
      fontSize: 14,
      color: theme.palette.muted,
    },
    label: {
      fontSize: 13,
      color: theme.palette.muted,
    },
    labelPassing: {
      color: theme.palette.success,
    },
  });
}

export default PasswordChecklist;
