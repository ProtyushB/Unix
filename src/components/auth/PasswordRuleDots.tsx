import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Circle, CircleCheck } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { PASSWORD_RULES } from '../../utils/validators';

// The compact five-dot password checklist from mockups 02 / 04.
//
// Deliberately unlabelled — the signup screen already carries four fields and a
// stepper, and five lines of rule text pushed the submit button off-screen.
// Each dot still exposes its rule to screen readers, and the full-text
// PasswordChecklist is still used where there is room for it.

interface PasswordRuleDotsProps {
  password: string;
}

export function PasswordRuleDots({ password }: PasswordRuleDotsProps) {
  const { palette } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="list">
      {PASSWORD_RULES.map(rule => {
        const met = rule.test(password);
        const Icon = met ? CircleCheck : Circle;
        return (
          <Icon
            key={rule.label}
            size={16}
            color={met ? palette.success : palette.muted}
            accessibilityRole="text"
            accessibilityLabel={`${rule.label}: ${met ? 'met' : 'not met'}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
});

export default PasswordRuleDots;
