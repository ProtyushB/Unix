import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { darkPalette, themes } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OPTION_HEIGHT = 50;
const MAX_VISIBLE = 5;
const SEARCH_BAR_HEIGHT = 48;

// ─── Component ──────────────────────────────────────────────────────────────

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  error,
}: SelectFieldProps) {
  const triggerRef = useRef<TouchableOpacity>(null);
  const searchRef = useRef<TextInput>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0 });

  const selectedLabel = options.find(o => o.value === value)?.label;

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const listHeight = Math.min(filtered.length, MAX_VISIBLE) * OPTION_HEIGHT;
  const dropdownHeight = SEARCH_BAR_HEIGHT + listHeight + (filtered.length === 0 ? OPTION_HEIGHT : 0);

  const openDropdown = () => {
    triggerRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setDropdownPos({ x: px, y: py + height + 4, width });
      setSearch('');
      setIsOpen(true);
      setTimeout(() => searchRef.current?.focus(), 80);
    });
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch('');
  };

  const handleSelect = (val: string) => {
    onChange(val);
    closeDropdown();
  };

  const borderColor = error ? '#ef4444' : 'rgba(51, 65, 85, 0.7)';

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        ref={triggerRef}
        onPress={openDropdown}
        style={[styles.field, { borderColor }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !selectedLabel && styles.placeholder]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Text style={[styles.arrow, isOpen && styles.arrowOpen]}>▾</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={closeDropdown}
          activeOpacity={1}
        />

        {/* Dropdown */}
        <View
          style={[
            styles.dropdown,
            {
              left: dropdownPos.x,
              top: dropdownPos.y,
              width: dropdownPos.width,
              height: dropdownHeight,
            },
          ]}
        >
          {/* Search bar */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor={darkPalette.muted}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Options list */}
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={filtered.length > MAX_VISIBLE}
            keyboardShouldPersistTaps="handled"
            style={{ height: listHeight || OPTION_HEIGHT }}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No results for "{search}"</Text>
              </View>
            ) : (
              filtered.map(option => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleSelect(option.value)}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: darkPalette.text,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  fieldText: {
    fontSize: 16,
    color: darkPalette.text,
    flex: 1,
  },
  placeholder: {
    color: darkPalette.muted,
  },
  arrow: {
    fontSize: 16,
    color: darkPalette.muted,
  },
  arrowOpen: {
    color: themes.default.primary,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },

  // Dropdown container
  dropdown: {
    position: 'absolute',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 18,
    color: darkPalette.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: darkPalette.text,
    paddingVertical: 0,
  },
  clearIcon: {
    fontSize: 13,
    color: darkPalette.muted,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },

  // Options
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    height: OPTION_HEIGHT,
  },
  optionSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  optionText: {
    fontSize: 15,
    color: darkPalette.text,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: themes.default.primary,
  },
  checkmark: {
    fontSize: 16,
    color: themes.default.primary,
  },
  emptyRow: {
    height: OPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: darkPalette.muted,
  },
});

export default SelectField;
