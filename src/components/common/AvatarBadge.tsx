import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AvatarBadgeProps {
  name: string;
  size?: number;
  color?: string;
  showBadge?: boolean;
  badgeColor?: string;
}

// ─── Default Colors (picked based on name hash) ────────────────────────────

const AVATAR_COLORS = [
  '#f97316',
  '#0ea5e9',
  '#10b981',
  '#8b5cf6',
  '#e11d48',
  '#f59e0b',
  '#14b8a6',
  '#6366f1',
] as const;

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
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
  badgeColor = '#10b981',
}: AvatarBadgeProps) {
  const bgColor = color ?? getColorFromName(name);
  const initials = useMemo(() => getInitials(name), [name]);
  const fontSize = Math.round(size * 0.38);
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
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      </View>

      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badgeColor,
              borderWidth: 2,
              borderColor: '#0f172a',
            },
          ]}
        />
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});
