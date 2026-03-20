import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Package } from 'lucide-react-native';
import { darkPalette } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  brand: string;
  price: number;
  status: string;
  imageUri?: string;
}

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {product.imageUri ? (
          <Image source={{ uri: product.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Package size={22} color={darkPalette.muted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
      </View>

      {/* Price + Status */}
      <View style={styles.trailing}>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
        <StatusPill status={product.status} />
      </View>
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
  brand: {
    fontSize: 12,
    color: darkPalette.muted,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: darkPalette.text,
  },
});
