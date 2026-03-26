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
                  <Icon size={20} color={isActive ? '#f97316' : '#64748b'} />
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

const styles = StyleSheet.create({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end'},
  overlayBg: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24},
  sheetTitle: {fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16},
  option: {flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1},
  optionActive: {backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.3)'},
  optionInactive: {backgroundColor: 'rgba(51,65,85,0.4)', borderColor: 'rgba(51,65,85,0.6)'},
  optionMarginBottom: {marginBottom: 10},
  iconWrapActive: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center'},
  iconWrapInactive: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(51,65,85,0.6)', alignItems: 'center', justifyContent: 'center'},
  labelActive: {flex: 1, fontSize: 16, fontWeight: '600', color: '#f97316'},
  labelInactive: {flex: 1, fontSize: 16, fontWeight: '600', color: '#94a3b8'},
  activeDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316'},
});
