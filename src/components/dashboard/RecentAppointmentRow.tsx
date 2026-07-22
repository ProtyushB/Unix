import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { StatusPill } from '../common/StatusPill';
import { TimeChip } from './TimeChip';
import { formatTimeParts } from '../../utils/formatters';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RecentAppointment {
  id: number | string;
  serviceName: string;
  customerName: string;
  appointmentNumber: string;
  status: string;
  when: string | null;
}

interface RecentAppointmentRowProps {
  appointment: RecentAppointment;
  divided: boolean;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
// Mockup node `sYDqN`: accent time chip | service + customer + number |
// status pill + chevron. Note the service — not the customer — leads the row.

export function RecentAppointmentRow({
  appointment,
  divided,
  onPress,
}: RecentAppointmentRowProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divided && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <TimeChip parts={formatTimeParts(appointment.when)} variant="accent" />

      <View style={styles.mid}>
        <Text style={styles.service} numberOfLines={1}>
          {appointment.serviceName}
        </Text>
        <Text style={styles.who} numberOfLines={1}>
          {appointment.customerName}
        </Text>
        <Text style={styles.number} numberOfLines={1}>
          {appointment.appointmentNumber}
        </Text>
      </View>

      <View style={styles.right}>
        <StatusPill status={appointment.status} />
        <ChevronRight size={18} color={palette.muted} />
      </View>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    divided: {
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    pressed: {
      backgroundColor: theme.colors.softBg,
    },
    mid: {
      flex: 1,
      gap: 4,
    },
    service: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
    },
    who: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    number: {
      fontSize: 11.5,
      fontWeight: '500',
      color: theme.palette.muted,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
  });
}
