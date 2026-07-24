import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// Google / Apple sign-in row.
//
// NOTE: there is no OAuth provider wired to the auth service yet — these are
// presentational, exactly as they are on the Centrix web app (its buttons carry
// no onClick either). Rather than leave them silently dead, onUnavailable is
// called so the caller can surface a toast. Delete that prop the day a real
// provider lands.

const GOOGLE_PATH =
  'M13.545 10.239v-3.242h5.545c.15.702.241 1.426.241 2.188 0 2.803-.988 5.278-2.706 6.895-1.544 1.548-3.583 2.447-6.08 2.447-4.688 0-8.545-3.805-8.545-8.5 0-4.695 3.857-8.5 8.545-8.5 2.274 0 4.186.783 5.554 2.063l-2.25 2.25c-.613-.593-1.719-1.313-3.304-1.313-2.829 0-5.133 2.279-5.133 5.091s2.304 5.091 5.133 5.091c2.062 0 3.25-.834 4.006-1.594.615-.616.977-1.523 1.129-2.75h-5.135z';

const APPLE_PATH =
  'M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z';

interface SocialRowProps {
  onUnavailable: (provider: string) => void;
  disabled?: boolean;
}

export function SocialRow({ onUnavailable, disabled = false }: SocialRowProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {[
        { name: 'Google', path: GOOGLE_PATH },
        { name: 'Apple', path: APPLE_PATH },
      ].map(({ name, path }) => (
        <TouchableOpacity
          key={name}
          style={styles.button}
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => onUnavailable(name)}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d={path} fill={palette.onSurface} />
          </Svg>
          <Text style={styles.label}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 13,
    },
    button: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    label: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: theme.palette.onSurface,
    },
  });
}

export default SocialRow;
