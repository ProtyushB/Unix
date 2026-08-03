import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

/**
 * Opaque strips over the status bar and gesture/nav bar zones.
 *
 * Under RN 0.82 the app is edge-to-edge, so the system bars are translucent and
 * a full-bleed ScrollView's content scrolls *under* them — you'd see the form
 * bleeding through the clock and the nav buttons. These masks paint the bar
 * zones with the page background so those areas only ever show the background,
 * never scrolled content. Rendered with a high zIndex so they sit above the
 * scroll regardless of where they appear in the tree; pointerEvents="none" so
 * they never eat touches.
 *
 * The background glows (AuthBackground) are intentionally covered inside the bar
 * strips — a solid background there is exactly the "background only" look we want.
 */
export function AuthBarMask() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();

  const topH = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
  const bottomH = insets.bottom;
  const bg = palette.background;

  return (
    <>
      {topH > 0 && (
        <View pointerEvents="none" style={[styles.top, { height: topH, backgroundColor: bg }]} />
      )}
      {bottomH > 0 && (
        <View
          pointerEvents="none"
          style={[styles.bottom, { height: bottomH, backgroundColor: bg }]}
        />
      )}
      {/* Side strips for landscape display cutouts — the top/bottom strips alone leave scrolled
          content visible beside the notch when the device is rotated. */}
      {insets.left > 0 && (
        <View
          pointerEvents="none"
          style={[styles.left, { width: insets.left, backgroundColor: bg }]}
        />
      )}
      {insets.right > 0 && (
        <View
          pointerEvents="none"
          style={[styles.right, { width: insets.right, backgroundColor: bg }]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  left: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
  right: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 20,
  },
});

export default AuthBarMask;
