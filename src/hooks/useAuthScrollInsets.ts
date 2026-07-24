import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StatusBar, type ViewStyle } from 'react-native';

/**
 * Top/bottom padding that keeps auth-screen content clear of the status bar and
 * the gesture nav bar. The auth screens roll their own full-bleed View +
 * ScrollView (so the background glows reach the screen edges) rather than using
 * ScreenWrapper's SafeAreaView, so they need the insets applied to the scroll
 * content explicitly. Spread onto each ScrollView's contentContainerStyle.
 *
 * Why the StatusBar.currentHeight floor: under RN 0.82 the app is edge-to-edge
 * by default (draws under the status bar), and on some devices
 * useSafeAreaInsets().top comes back as 0 for scroll content — which let the
 * brand mark render up into the status bar. StatusBar.currentHeight always
 * reports the real Android status-bar height, so flooring with it guarantees a
 * true gap regardless of what the inset reports.
 */
export function useAuthScrollInsets(): Pick<ViewStyle, 'paddingTop' | 'paddingBottom'> {
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const top = Math.max(insets.top, androidStatusBar);
  return {
    paddingTop: top + 20,
    paddingBottom: insets.bottom + 24,
  };
}
