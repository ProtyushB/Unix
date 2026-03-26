import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Tab {
  key: string;
  label: string;
}

interface TopTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TopTabBar({ tabs, activeTab, onTabChange }: TopTabBarProps) {
  const styles = useThemedStyles(createStyles);

  const renderTab = useCallback(
    (tab: Tab) => {
      const isActive = tab.key === activeTab;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onTabChange(tab.key)}
          activeOpacity={0.7}
          style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
        >
          <Text
            style={[
              styles.pillText,
              isActive ? styles.pillTextActive : styles.pillTextInactive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [activeTab, onTabChange, styles],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {tabs.map(renderTab)}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    pill: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 9999,
    },
    pillActive: {
      backgroundColor: theme.colors.primary,
    },
    pillInactive: {
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
    },
    pillTextActive: {
      color: '#ffffff',
    },
    pillTextInactive: {
      color: theme.palette.muted,
    },
  });
}
