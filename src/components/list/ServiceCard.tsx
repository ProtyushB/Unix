import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Scissors } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Service {
  id: number;
  name: string;
  price: number;
  duration: string;
  status: string;
  imageUri?: string;
}

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ServiceCard({ service, onPress }: ServiceCardProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {service.imageUri ? (
          <Image source={{ uri: service.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Scissors size={22} color={palette.muted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {service.name}
        </Text>
        <Text style={styles.duration}>{service.duration}</Text>
      </View>

      {/* Price */}
      <Text style={styles.price}>{formatCurrency(service.price)}</Text>
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
    },
    imageContainer: {
      width: 48,
      height: 48,
      borderRadius: 10,
      overflow: 'hidden',
      marginRight: 12,
    },
    image: {
      width: 48,
      height: 48,
      resizeMode: 'cover',
    },
    placeholder: {
      width: 48,
      height: 48,
      backgroundColor: theme.palette.divider,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      marginRight: 10,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.palette.onBackground,
      marginBottom: 2,
    },
    duration: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    price: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
  });
}
