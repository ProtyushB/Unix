import React, { useState } from 'react';
import {
  Image,
  View,
  ActivityIndicator,
  StyleSheet,
  type ImageStyle,
} from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DmsImageProps {
  dmsFileId: number;
  style?: ImageStyle;
  placeholder?: React.ReactNode;
  baseUrl?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DmsImage({
  dmsFileId,
  style,
  placeholder,
  baseUrl = '',
}: DmsImageProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const uri = baseUrl
    ? `${baseUrl}/api/files/${dmsFileId}/preview`
    : '';

  if (!baseUrl || error) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        {placeholder ?? <ImageIcon size={24} color={palette.muted} />}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri }}
        style={[styles.image, style]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        resizeMode="cover"
      />
      {loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 10,
      backgroundColor: theme.palette.divider,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    loaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.background + '66',
    },
    placeholderContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.divider,
      borderRadius: 10,
      overflow: 'hidden',
    },
  });
}
