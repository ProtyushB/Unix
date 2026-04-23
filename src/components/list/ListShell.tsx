import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ArrowLeft, Search, X, List, LayoutGrid } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';
import { FAB } from '../layout/FAB';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListShellFilter {
  id:     string;
  label:  string;
  icon?:  LucideIcon;
  color?: string;
}

interface ListShellProps {
  title: string;

  /** Back button handler — renders the arrow if provided. */
  onBack?: () => void;

  /** Filter chips below the search bar. */
  filters?:        ListShellFilter[];
  activeFilter?:   string;
  onFilterChange?: (id: string) => void;

  /** Show an always-visible search input. */
  enableSearch?:   boolean;
  searchValue?:    string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** List/Grid toggle — shown only when both onViewChange and view are set. */
  view?:         'list' | 'grid';
  onViewChange?: (view: 'list' | 'grid') => void;

  /** Extra icons in the header right side, left of the view toggle. */
  headerActions?: React.ReactNode;

  /** Floating action button — shown only when onAdd is set. */
  onAdd?:   () => void;
  addIcon?: React.ReactNode;

  children: React.ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ListShell({
  title,
  onBack,
  filters,
  activeFilter,
  onFilterChange,
  enableSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  view,
  onViewChange,
  headerActions,
  onAdd,
  addIcon,
  children,
}: ListShellProps) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.screen}>
      {/* Top bar: back + title + actions */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {onBack && (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              android_ripple={{ color: palette.divider, borderless: true, radius: 20 }}
              style={styles.iconBtn}
            >
              <ArrowLeft size={22} color={palette.onBackground} />
            </Pressable>
          )}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>

        <View style={styles.topBarRight}>
          {headerActions}
          {view && onViewChange && (
            <View style={styles.viewToggle}>
              <Pressable
                onPress={() => onViewChange('list')}
                style={[styles.viewToggleBtn, view === 'list' && styles.viewToggleBtnActive]}
                android_ripple={{ color: palette.divider, borderless: true, radius: 16 }}
              >
                <List size={16} color={view === 'list' ? colors.primary : palette.muted} />
              </Pressable>
              <Pressable
                onPress={() => onViewChange('grid')}
                style={[styles.viewToggleBtn, view === 'grid' && styles.viewToggleBtnActive]}
                android_ripple={{ color: palette.divider, borderless: true, radius: 16 }}
              >
                <LayoutGrid size={16} color={view === 'grid' ? colors.primary : palette.muted} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Search */}
      {enableSearch && (
        <View style={styles.searchWrap}>
          <Search size={16} color={palette.muted} style={styles.searchIcon} />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {!!searchValue && (
            <Pressable
              onPress={() => onSearchChange?.('')}
              hitSlop={10}
              android_ripple={{ color: palette.divider, borderless: true, radius: 14 }}
              style={styles.searchClear}
            >
              <X size={16} color={palette.muted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          {filters.map(filter => {
            const isActive = activeFilter === filter.id;
            const Icon = filter.icon;
            const accent = filter.color ?? colors.primary;
            return (
              <Pressable
                key={filter.id}
                onPress={() => onFilterChange?.(filter.id)}
                android_ripple={{ color: palette.divider }}
                style={[
                  styles.chip,
                  isActive && { backgroundColor: accent + '22', borderColor: accent },
                ]}
              >
                {Icon && (
                  <Icon
                    size={13}
                    color={isActive ? accent : palette.muted}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.chipLabel,
                    isActive && { color: accent },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Body */}
      <View style={styles.body}>{children}</View>

      {/* FAB */}
      {onAdd && <FAB onPress={onAdd} icon={addIcon} />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex:            1,
      backgroundColor: theme.palette.background,
    },
    topBar: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingTop:        12,
      paddingBottom:     8,
      gap:               12,
    },
    topBarLeft: {
      flex:          1,
      flexDirection: 'row',
      alignItems:    'center',
      gap:           10,
      minWidth:      0,
    },
    topBarRight: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           8,
    },
    iconBtn: {
      padding: 4,
    },
    title: {
      flex:       1,
      fontSize:   22,
      fontWeight: '700',
      color:      theme.palette.onBackground,
    },
    viewToggle: {
      flexDirection:   'row',
      backgroundColor: theme.palette.surface,
      borderWidth:     1,
      borderColor:     theme.palette.divider,
      borderRadius:    10,
      padding:         2,
    },
    viewToggleBtn: {
      paddingHorizontal: 8,
      paddingVertical:   6,
      borderRadius:      8,
    },
    viewToggleBtnActive: {
      backgroundColor: theme.colors.softBg,
    },
    searchWrap: {
      flexDirection:     'row',
      alignItems:        'center',
      backgroundColor:   theme.palette.surface,
      borderWidth:       1,
      borderColor:       theme.palette.divider,
      borderRadius:      12,
      marginHorizontal:  16,
      marginTop:         4,
      marginBottom:      8,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex:            1,
      color:           theme.palette.onBackground,
      fontSize:        14,
      paddingVertical: 10,
    },
    searchClear: {
      padding: 4,
    },
    filterRow: {
      maxHeight:    40,
      marginTop:    2,
      marginBottom: 6,
      flexGrow:     0,
    },
    filterRowContent: {
      paddingHorizontal: 16,
      gap:               8,
      alignItems:        'center',
    },
    chip: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: 14,
      paddingVertical:   7,
      borderRadius:      20,
      backgroundColor:   theme.palette.surface,
      borderWidth:       1,
      borderColor:       theme.palette.divider,
    },
    chipLabel: {
      fontSize:   13,
      fontWeight: '600',
      color:      theme.palette.muted,
    },
    body: {
      flex: 1,
    },
  });
}
