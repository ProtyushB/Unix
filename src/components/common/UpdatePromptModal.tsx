import React from 'react';
import {Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {useThemedStyles} from '../../hooks/useThemedStyles';
import {useAppUpdate, type UseAppUpdateResult} from '../../hooks/useAppUpdate';
import {AppButton} from './AppButton';
import type {AppTheme} from '../../theme/theme.types';

/**
 * Offers a newer self-hosted APK, downloads it, and hands it to the installer.
 *
 * Props-less and self-mounting, following the `BiometricOnboardingModal`
 * precedent: it returns null until it has something to say, so a host screen
 * mounts it once and never thinks about it again. Mounted in both tab
 * navigators; `useAppUpdate` dedupes the automatic check to once per process.
 *
 * Not built on `ConfirmDialog`. That component types `message` as a string and
 * renders a fixed two-button row — a progress bar does not fit, and widening it
 * for this one caller would degrade a component used across a dozen screens.
 * Its Modal/backdrop/card structure is reused instead.
 */
export function UpdatePromptModal() {
  const controller = useAppUpdate(true);
  return <UpdatePrompt controller={controller} />;
}

/**
 * The presentational half, driven by a caller-owned `useAppUpdate`.
 *
 * Split out so the Account screen's manual "Check for updates" can show the same
 * prompt from its own hook instance. Each `useAppUpdate` call has independent
 * state, so a manual check could not drive the auto-mounted modal above — and
 * duplicating this UI for the manual path would guarantee the two drift.
 */
export function UpdatePrompt({controller}: {controller: UseAppUpdateResult}) {
  const {stage, manifest, progress, error, startDownload, dismiss, openInstallSettings} =
    controller;
  const styles = useThemedStyles(createStyles);

  // 'checking' and 'idle' stay invisible — an update the user did not ask about
  // should not announce that it is looking.
  const visible =
    manifest !== null &&
    (stage === 'available' ||
      stage === 'downloading' ||
      stage === 'verifying' ||
      stage === 'launching' ||
      stage === 'failed');

  if (!visible || !manifest) return null;

  const busy = stage === 'downloading' || stage === 'verifying' || stage === 'launching';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Android back button. Blocked while busy so a stray tap cannot abandon a
      // download mid-flight, which would also count as dismissing the release.
      onRequestClose={busy ? () => {} : dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>⬆️</Text>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.subtitle}>
            Version {manifest.versionName} is ready to install.
          </Text>

          {/* Shown before the tap, not after. There is no NetInfo dependency in
              the app so metered-connection detection is a deliberate non-goal —
              stating the size is the mitigation for a ~40 MB download on data. */}
          {manifest.sizeBytes ? (
            <Text style={styles.meta}>{formatSize(manifest.sizeBytes)}</Text>
          ) : null}

          {manifest.notes && manifest.notes.length > 0 ? (
            <View style={styles.notes}>
              {manifest.notes.map((note, i) => (
                <Text key={i} style={styles.note}>
                  • {note}
                </Text>
              ))}
            </View>
          ) : null}

          {stage === 'downloading' ? (
            <View style={styles.progressBlock}>
              {progress === null ? (
                // No Content-Length: an indeterminate spinner is honest, where a
                // bar frozen at 0% reads as a hung download.
                <ActivityIndicator style={styles.spinner} />
              ) : (
                <View style={styles.track}>
                  <View style={[styles.fill, {width: `${Math.round(progress * 100)}%`}]} />
                </View>
              )}
              <Text style={styles.progressText}>
                {progress === null ? 'Downloading…' : `Downloading… ${Math.round(progress * 100)}%`}
              </Text>
            </View>
          ) : null}

          {stage === 'verifying' ? <Text style={styles.progressText}>Verifying…</Text> : null}
          {stage === 'launching' ? (
            <Text style={styles.progressText}>Opening the installer…</Text>
          ) : null}

          {stage === 'failed' && error ? <Text style={styles.error}>{error}</Text> : null}

          {stage === 'failed' ? (
            <>
              {/* The install-blocked case is recoverable, so offer the way out
                  rather than only reporting the wall. */}
              <AppButton
                title="Open settings"
                onPress={openInstallSettings}
                variant="secondary"
                style={styles.button}
              />
              <AppButton title="Retry" onPress={startDownload} style={styles.button} />
            </>
          ) : null}

          {stage === 'available' ? (
            <AppButton title="Update now" onPress={startDownload} style={styles.button} />
          ) : null}

          {/* "Later" is always reachable except mid-download: updates are optional
              by design and nothing here may trap the user. */}
          {!busy ? (
            <TouchableOpacity style={styles.laterBtn} onPress={dismiss} activeOpacity={0.7}>
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.palette.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: theme.palette.surface,
      borderRadius: 24,
      padding: 28,
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    icon: {fontSize: 40, marginBottom: 12},
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: theme.palette.onSurface,
      textAlign: 'center',
      lineHeight: 21,
    },
    meta: {fontSize: 13, color: theme.palette.muted, marginTop: 6},
    notes: {alignSelf: 'stretch', marginTop: 14},
    note: {fontSize: 13, color: theme.palette.onSurface, lineHeight: 20},
    progressBlock: {alignSelf: 'stretch', marginTop: 20, alignItems: 'center'},
    spinner: {marginBottom: 8},
    track: {
      alignSelf: 'stretch',
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.palette.divider,
      overflow: 'hidden',
    },
    fill: {height: 6, borderRadius: 3, backgroundColor: theme.colors.primary},
    progressText: {fontSize: 13, color: theme.palette.muted, marginTop: 10, textAlign: 'center'},
    error: {
      fontSize: 13,
      color: theme.palette.error,
      marginTop: 16,
      textAlign: 'center',
      lineHeight: 19,
    },
    button: {alignSelf: 'stretch', marginTop: 12},
    laterBtn: {paddingVertical: 10, marginTop: 6},
    laterText: {fontSize: 14, color: theme.palette.muted, fontWeight: '500'},
  });
}
