import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Package } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

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
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {product.imageUri ? (
          <Image source={{ uri: product.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Package size={22} color={palette.muted} />
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
    brand: {
      fontSize: 12,
      color: theme.palette.muted,
    },
    trailing: {
      alignItems: 'flex-end',
      gap: 6,
    },
    price: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.palette.onBackground,
    },
  });
}
