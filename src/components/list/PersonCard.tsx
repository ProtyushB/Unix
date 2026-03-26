import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AvatarBadge } from '../common/AvatarBadge';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Person {
  id: number;
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
}

interface PersonCardProps {
  person: Person;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PersonCard({ person, onPress }: PersonCardProps) {
  const styles = useThemedStyles(createStyles);
  const fullName = `${person.firstName} ${person.lastName}`.trim();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <AvatarBadge name={fullName} size={42} />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {fullName}
        </Text>
        {person.role ? (
          <Text style={styles.role}>{person.role}</Text>
        ) : null}
      </View>

      {person.phone ? (
        <Text style={styles.phone}>{person.phone}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surface + '99',
      borderWidth: 1,
      borderColor: theme.palette.divider + '80',
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      gap: 12,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
      marginBottom: 2,
    },
    role: {
      fontSize: 12,
      color: theme.palette.muted,
      textTransform: 'capitalize',
    },
    phone: {
      fontSize: 13,
      color: theme.palette.muted,
    },
  });
}
