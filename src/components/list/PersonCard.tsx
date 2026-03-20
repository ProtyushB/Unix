import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkPalette } from '../../theme/colors';
import { AvatarBadge } from '../common/AvatarBadge';

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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
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
    color: darkPalette.text,
    marginBottom: 2,
  },
  role: {
    fontSize: 12,
    color: darkPalette.muted,
    textTransform: 'capitalize',
  },
  phone: {
    fontSize: 13,
    color: darkPalette.muted,
  },
});
