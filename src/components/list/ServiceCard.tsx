import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Scissors } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatters';

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
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {service.imageUri ? (
          <Image source={{ uri: service.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Scissors size={22} color={darkPalette.muted} />
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
    backgroundColor: darkPalette.border,
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
    color: darkPalette.text,
    marginBottom: 2,
  },
  duration: {
    fontSize: 12,
    color: darkPalette.muted,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: darkPalette.text,
  },
});
