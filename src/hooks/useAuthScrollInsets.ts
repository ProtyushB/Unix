import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StatusBar, type ViewStyle } from 'react-native';
import { useKeyboardHeight } from './useKeyboardHeight';

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
 *
 * The bottom edge also absorbs the keyboard. These screens wrap their content in
 * a KeyboardAvoidingView, but that is inert on Android (no `behavior` is passed
 * there) and `adjustResize` no longer lifts the window under enforced
 * edge-to-edge — so the last field or the submit button could sit behind the
 * keyboard. Padding by the keyboard height instead makes the scroll content
 * genuinely taller, so the field can be scrolled to.
 *
 * max() rather than a sum: when the keyboard is up it covers the gesture nav bar,
 * so adding both would leave a nav-bar-sized gap floating above the keyboard.
 */
export function useAuthScrollInsets(): Pick<ViewStyle, 'paddingTop' | 'paddingBottom'> {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const androidStatusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const top = Math.max(insets.top, androidStatusBar);
  return {
    paddingTop: top + 20,
    paddingBottom: Math.max(insets.bottom, keyboardHeight) + 24,
  };
}
