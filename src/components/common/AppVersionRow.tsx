import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../hooks/useTheme';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { APP_VERSION_NAME, UPDATES_SUPPORTED } from '../../config/appVersion';
import { UpdatePrompt } from './UpdatePromptModal';
import type { AppTheme } from '../../theme/theme.types';

/**
 * "App version" row with a manual update check.
 *
 * Two jobs beyond the obvious one. It is the only surface that reports a failed
 * check at all — the automatic check is deliberately silent, because a user who
 * did not ask a question should not be shown an error they cannot act on. And it
 * is the manual test harness for the whole updater: without it, exercising the
 * flow means waiting out a six-hour throttle.
 *
 * `useAppUpdate(false)` — no automatic check from here; this instance only ever
 * acts when the user taps.
 */
export function AppVersionRow() {
  const controller = useAppUpdate(false);
  const { stage, error, upToDate, checkNow } = controller;
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const checking = stage === 'checking';

  return (
    <>
      <View style={styles.row}>
        <Smartphone size={20} color={palette.muted} />
        <View style={styles.labelBlock}>
          <Text style={styles.label}>App version</Text>
          {/* versionName, not versionCode: the code is a CI counter that means
              nothing to a user, but it is what a support conversation needs, so
              the name embeds the build number ("1.0.0-42"). */}
          <Text style={styles.value}>{APP_VERSION_NAME}</Text>
        </View>

        {/* Hidden rather than disabled where updates cannot work at all (iOS, the
            web preview, or a build that could not read its own version) — a
            permanently dead button invites bug reports. */}
        {UPDATES_SUPPORTED ? (
          <TouchableOpacity onPress={checkNow} disabled={checking} activeOpacity={0.7}>
            {checking ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.action}>Check for updates</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {upToDate ? <Text style={styles.hint}>You're on the latest version.</Text> : null}
      {error && stage !== 'failed' ? <Text style={styles.error}>{error}</Text> : null}

      {/* Same prompt the automatic check raises — driven by this hook instance. */}
      <UpdatePrompt controller={controller} />
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    labelBlock: { flex: 1 },
    label: { fontSize: 15, color: theme.palette.onBackground, fontWeight: '500' },
    value: { fontSize: 12, color: theme.palette.muted, marginTop: 2 },
    action: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
    hint: { fontSize: 12, color: theme.palette.muted, marginBottom: 8 },
    error: { fontSize: 12, color: theme.palette.error, marginBottom: 8 },
  });
}
