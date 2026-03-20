import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkPalette } from '../../theme/colors';
import { formatDateTime } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Appointment {
  id: number;
  customerId: number;
  customerName?: string;
  serviceName?: string;
  appointmentDateTime: string;
  status: string;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AppointmentCard({ appointment, onPress }: AppointmentCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Left: DateTime */}
      <View style={styles.dateCol}>
        <Text style={styles.dateTime}>
          {formatDateTime(appointment.appointmentDateTime)}
        </Text>
      </View>

      {/* Middle: Customer + service */}
      <View style={styles.info}>
        {appointment.customerName ? (
          <Text style={styles.customer} numberOfLines={1}>
            {appointment.customerName}
          </Text>
        ) : null}
        {appointment.serviceName ? (
          <Text style={styles.service} numberOfLines={1}>
            {appointment.serviceName}
          </Text>
        ) : null}
      </View>

      {/* Right: Status */}
      <StatusPill status={appointment.status} />
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
  },
  dateCol: {
    marginRight: 12,
    minWidth: 80,
  },
  dateTime: {
    fontSize: 11,
    fontWeight: '600',
    color: darkPalette.muted,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  customer: {
    fontSize: 14,
    fontWeight: '600',
    color: darkPalette.text,
    marginBottom: 2,
  },
  service: {
    fontSize: 12,
    color: darkPalette.muted,
  },
});
