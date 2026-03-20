import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PasswordMatchProps {
  password: string;
  confirmPassword: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PasswordMatch({ password, confirmPassword }: PasswordMatchProps) {
  if (!confirmPassword) {
    return null;
  }

  const matches = password === confirmPassword;

  return (
    <View style={styles.container}>
      {matches ? (
        <>
          <CheckCircle2 size={16} color="#10b981" />
          <Text style={styles.matchText}>Passwords match</Text>
        </>
      ) : (
        <>
          <XCircle size={16} color="#ef4444" />
          <Text style={styles.mismatchText}>Passwords do not match</Text>
        </>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#10b981',
  },
  mismatchText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
  },
});
