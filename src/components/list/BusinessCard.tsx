import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { darkPalette, themes } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Business {
  id: number;
  businessName: string;
  businessType: string;
  imageUri?: string;
}

interface BusinessCardProps {
  business: Business;
  onPress: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BusinessCard({ business, onPress }: BusinessCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Image */}
      <View style={styles.imageContainer}>
        {business.imageUri ? (
          <Image source={{ uri: business.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Building2 size={28} color={darkPalette.muted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {business.businessName}
        </Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{business.businessType}</Text>
        </View>
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
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 14,
  },
  image: {
    width: 56,
    height: 56,
    resizeMode: 'cover',
  },
  placeholder: {
    width: 56,
    height: 56,
    backgroundColor: darkPalette.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: darkPalette.text,
    marginBottom: 6,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: themes.default.softBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: themes.default.primary,
    textTransform: 'capitalize',
  },
});
