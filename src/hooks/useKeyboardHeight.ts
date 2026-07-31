import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, or 0 when it is closed.
 *
 * Exists because `KeyboardAvoidingView` is inert on Android as this app configures it
 * (`behavior` is only set on iOS, and with no behavior the component renders a plain View). The
 * code leaned on `android:windowSoftInputMode="adjustResize"` instead — but at targetSdk 36 the
 * app is permanently edge-to-edge and the window no longer resizes for the IME, so nothing was
 * lifting content off the keyboard. Apps are expected to consume the IME inset themselves.
 *
 * RN core exposes no IME inset, but `keyboardDidShow` still reports the real height on Android
 * whether or not the window resized, so that is the signal used here.
 *
 * Android gets `keyboardDidShow`/`Hide` rather than the `Will` variants: the `Will` events are
 * iOS-only and never fire on Android, so listening for them would leave this permanently 0.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
