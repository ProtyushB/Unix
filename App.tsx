import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StyleSheet} from 'react-native';
import {ThemeProvider} from './src/context/ThemeContext';
import {AppProvider} from './src/context/AppContext';
import {ToastProvider} from './src/context/ToastContext';
import {RootNavigator} from './src/navigation/RootNavigator';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
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
