import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import {User, Building2} from 'lucide-react-native';
import {PORTALS, PORTAL_ORDER, PortalKey} from '../../utils/portals';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

interface Props {
  visible: boolean;
  activeKey: PortalKey;
  availableKeys: PortalKey[];
  slideAnim: Animated.Value;
  overlayAnim: Animated.Value;
  onClose: () => void;
  onSwitch: (key: PortalKey) => void;
}

const PORTAL_ICONS: Record<PortalKey, React.ComponentType<{size: number; color: string}>> = {
  customer: User,
  business: Building2,
};

export function PortalSwitcherSheet({
  visible,
  activeKey,
  availableKeys,
  slideAnim,
  overlayAnim,
  onClose,
  onSwitch,
}: Props) {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const portalsToShow = PORTAL_ORDER.filter(key => availableKeys.includes(key));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.overlayBg, {opacity: overlayAnim}]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, {transform: [{translateY: slideAnim}]}]}>
          <Text style={styles.sheetTitle}>Switch Portal</Text>
          {portalsToShow.map((key, index) => {
            const portal = PORTALS[key];
            const isActive = key === activeKey;
            const Icon = PORTAL_ICONS[key];
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.option,
                  isActive ? styles.optionActive : styles.optionInactive,
                  index < portalsToShow.length - 1 && styles.optionMarginBottom,
                ]}
                onPress={() => !isActive && onSwitch(key)}
                activeOpacity={isActive ? 1 : 0.7}>
                <View style={isActive ? styles.iconWrapActive : styles.iconWrapInactive}>
                  <Icon size={20} color={isActive ? colors.primary : palette.muted} />
                </View>
                <Text style={isActive ? styles.labelActive : styles.labelInactive}>
                  {portal.label}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end'},
    overlayBg: {...StyleSheet.absoluteFillObject, backgroundColor: theme.palette.overlay},
    sheet: {
      backgroundColor: theme.palette.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
    },
    sheetTitle: {fontSize: 18, fontWeight: '700', color: theme.palette.onBackground, marginBottom: 16},
    option: {flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1},
    optionActive:  {backgroundColor: theme.colors.softBg,  borderColor: theme.colors.border},
    optionInactive: {backgroundColor: theme.palette.divider + '66', borderColor: theme.palette.divider + '99'},
    optionMarginBottom: {marginBottom: 10},
    iconWrapActive:   {width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.softBg, alignItems: 'center', justifyContent: 'center'},
    iconWrapInactive: {width: 40, height: 40, borderRadius: 12, backgroundColor: theme.palette.divider + '99', alignItems: 'center', justifyContent: 'center'},
    labelActive:   {flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.primary},
    labelInactive: {flex: 1, fontSize: 16, fontWeight: '600', color: theme.palette.onSurface},
    activeDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary},
  });
}
