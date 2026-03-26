import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AvatarBadgeProps {
  name: string;
  size?: number;
  /** Override background colour (bypasses theme pool). */
  color?: string;
  showBadge?: boolean;
  badgeColor?: string;
}

// ─── Initials ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AvatarBadge({
  name,
  size = 40,
  color,
  showBadge = false,
  badgeColor,
}: AvatarBadgeProps) {
  const { avatar, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const pair = useMemo(() => avatar.forName(name), [avatar, name]);

  const bgColor = color ?? pair.bg;
  const textColor = color ? '#ffffff' : pair.text;
  const resolvedBadgeColor = badgeColor ?? palette.success;
  const initials = useMemo(() => getInitials(name), [name]);
  const initFontSize = Math.round(size * 0.38);
  const badgeSize = Math.round(size * 0.28);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize: initFontSize, color: textColor }]}>
          {initials}
        </Text>
      </View>

      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: resolvedBadgeColor,
              borderWidth: 2,
              borderColor: palette.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    container: {
      position: 'relative',
    },
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontWeight: '700',
    },
    badge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
  });
}
