import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context';
import {StyleSheet} from 'react-native';
import {ThemeProvider} from './src/context/ThemeContext';
import {AppProvider} from './src/context/AppContext';
import {ToastProvider} from './src/context/ToastContext';
import {RootNavigator} from './src/navigation/RootNavigator';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* initialMetrics is not an optimisation. Without it SafeAreaProvider renders NOTHING —
          not the navigator, not the bootstrap — until the first native insets round-trip lands,
          so cold start shows the bare Android window background and RootNavigator's token read,
          portal derivation and biometric gate do not even begin until a frame later. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <AppProvider>
            {/* Inside ThemeProvider (the toast reads accent colours from it) and
                wrapping the navigator, so the single overlay sits above every
                screen and survives navigation. */}
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
