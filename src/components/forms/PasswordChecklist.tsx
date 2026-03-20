import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { PASSWORD_RULES } from '../../utils/validators';
import { darkPalette } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PasswordChecklistProps {
  password: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  return (
    <View style={styles.container}>
      {PASSWORD_RULES.map((rule, index) => {
        const passes = rule.test(password);
        return (
          <View key={index} style={styles.row}>
            {passes ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <Circle size={16} color={darkPalette.muted} />
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

const styles = StyleSheet.create({
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
  label: {
    fontSize: 13,
    color: darkPalette.muted,
  },
  labelPassing: {
    color: '#10b981',
  },
});
