import {useState, useEffect, useCallback} from 'react';
import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import {biometricStorage} from '../storage/biometric.storage';

const rnBiometrics = new ReactNativeBiometrics({allowDeviceCredentials: false});

export interface BiometricState {
  available: boolean;
  biometryType: string | null;
  biometryLabel: string;
  enabled: boolean;
  loading: boolean;
}

export function useBiometric() {
  const [state, setState] = useState<BiometricState>({
    available: false,
    biometryType: null,
    biometryLabel: 'Biometric',
    enabled: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const {available, biometryType} = await rnBiometrics.isSensorAvailable();
      const enabled = await biometricStorage.isEnabled();
      const label =
        biometryType === BiometryTypes.FaceID
          ? 'Face ID'
          : biometryType === BiometryTypes.TouchID
          ? 'Touch ID'
          : 'Fingerprint';
      setState({
        available,
        biometryType: biometryType ?? null,
        biometryLabel: label,
        enabled,
        loading: false,
      });
    } catch {
      setState(s => ({...s, available: false, loading: false}));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const prompt = useCallback(
    async (message = 'Verify your identity'): Promise<boolean> => {
      try {
        const {success} = await rnBiometrics.simplePrompt({
          promptMessage: message,
        });
        return success;
      } catch {
        return false;
      }
    },
    [],
  );

  const enable = useCallback(async (): Promise<boolean> => {
    const success = await prompt('Confirm to enable biometric login');
    if (success) {
      await biometricStorage.setEnabled(true);
      await biometricStorage.setPromptSeen();
      setState(s => ({...s, enabled: true}));
    }
    return success;
  }, [prompt]);

  const disable = useCallback(async (): Promise<void> => {
    await biometricStorage.setEnabled(false);
    setState(s => ({...s, enabled: false}));
  }, []);

  return {...state, refresh, prompt, enable, disable};
}

// Standalone prompt used outside components (e.g. RootNavigator)
export async function promptBiometric(
  message = 'Verify your identity',
): Promise<boolean> {
  try {
    const {success} = await rnBiometrics.simplePrompt({promptMessage: message});
    return success;
  } catch {
    return false;
  }
}
