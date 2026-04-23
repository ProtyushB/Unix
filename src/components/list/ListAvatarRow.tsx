import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListAvatarRowProps {
  name:      string;
  subtitle?: string;
  trailing?: string;
  onPress?:  () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────
// Pattern E: Avatar row. Color-keyed initials bubble on the left (deterministic
// from the name via theme.avatar.forName), name + role, chevron.

export function ListAvatarRow({
  name,
  subtitle,
  trailing,
  onPress,
}: ListAvatarRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const avatarColors = theme.avatar.forName(name);
  const initials     = getInitials(name);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.palette.divider }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColors.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColors.text }]}>{initials}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      {trailing && <Text style={styles.trailing}>{trailing}</Text>}
      <ChevronRight size={18} color={theme.palette.muted} />
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: 16,
      paddingVertical:   12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.palette.divider,
      gap:               12,
    },
    rowPressed: {
      backgroundColor: theme.palette.surface,
    },
    avatar: {
      width:          40,
      height:         40,
      borderRadius:   20,
      alignItems:     'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize:   14,
      fontWeight: '700',
    },
    body: {
      flex: 1,
      gap:  2,
    },
    name: {
      fontSize:   15,
      fontWeight: '600',
      color:      theme.palette.onBackground,
    },
    subtitle: {
      fontSize: 12,
      color:    theme.palette.muted,
    },
    trailing: {
      fontSize:   13,
      fontWeight: '600',
      color:      theme.palette.muted,
    },
  });
}
