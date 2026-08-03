import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Linking, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { APP_VERSION_CODE, UPDATES_SUPPORTED, UPDATE_MANIFEST_URL } from '../config/appVersion';
import { fetchManifest, type UpdateManifest } from '../services/updateService';
import { CHECK_THROTTLE_MS, updateStorage } from '../storage/update.storage';

/**
 * The self-hosted APK updater.
 *
 * Unix is distributed from centrixpro.in rather than the Play Store, so the
 * whole cycle — notice, download, verify, hand to the installer — is ours.
 * Updates are optional and dismissible by design: nothing here ever blocks the
 * app, and every failure path degrades to silence rather than an error the user
 * cannot act on.
 *
 * The pure decision logic lives in `services/updateService.ts`; this file is the
 * part that needs native modules.
 */

export type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'launching'
  | 'failed';

/**
 * One automatic check per app process, not per mounted component.
 *
 * The updater is mounted in BOTH tab navigators so it survives whichever shell
 * the user lands in, and an owner switching profiles can mount the second while
 * the first is still alive. Without this the user would see two prompts stack.
 * Module scope is the same singleton idiom as `useDmsImages.ts`.
 */
let autoCheckDone = false;

/** Delay after interactions settle, so the check never competes with first paint. */
const STARTUP_DELAY_MS = 2500;

export interface UseAppUpdateResult {
  stage: UpdateStage;
  manifest: UpdateManifest | null;
  /** 0–1, or null when the server sent no Content-Length. */
  progress: number | null;
  error: string | null;
  /** True while a manual check found nothing — the only "no update" the user is told about. */
  upToDate: boolean;
  checkNow: () => Promise<void>;
  startDownload: () => Promise<void>;
  dismiss: () => void;
  openInstallSettings: () => Promise<void>;
}

export function useAppUpdate(auto: boolean): UseAppUpdateResult {
  const [stage, setStage] = useState<UpdateStage>('idle');
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState(false);

  const taskRef = useRef<{ cancel: (cb?: (reason: any) => void) => void } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abandon an in-flight download rather than leaking it and writing into a
      // cache dir nobody is watching.
      taskRef.current?.cancel(() => {});
      taskRef.current = null;
    };
  }, []);

  const runCheck = useCallback(async (options: { manual: boolean }): Promise<void> => {
    // Android only. iOS has no sideload path and the install intent below does
    // not exist there; on web the whole thing is meaningless.
    if (Platform.OS !== 'android' || !UPDATES_SUPPORTED) return;

    if (!options.manual) {
      const lastChecked = await updateStorage.getLastCheckedAt();
      if (Date.now() - lastChecked < CHECK_THROTTLE_MS) return;
    }

    if (mountedRef.current) {
      setStage('checking');
      setError(null);
      setUpToDate(false);
    }

    const verdict = await fetchManifest(UPDATE_MANIFEST_URL, APP_VERSION_CODE);
    await updateStorage.markChecked();
    if (!mountedRef.current) return;

    if (verdict.status === 'update-available') {
      // Per-version dismissal, checked here rather than inside the pure
      // evaluator so a manual check can deliberately ignore it — a user who
      // taps "Check for updates" is asking to see the thing they dismissed.
      if (!options.manual) {
        const dismissed = await updateStorage.getDismissedCode();
        if (!mountedRef.current) return;
        if (dismissed >= verdict.manifest.versionCode) {
          setStage('idle');
          return;
        }
      }
      // Free retry after a blocked or abandoned install: if the APK is already
      // sitting in cache and intact, the prompt goes straight to installing.
      void cleanStaleDownloads(verdict.manifest.versionCode);
      setManifest(verdict.manifest);
      setStage('available');
      return;
    }

    // Everything else is "say nothing". An automatic check that found no
    // update, a manifest that is not published, a device that is offline and a
    // build that cannot read its own version all look identical to the user,
    // which is correct — none of them is actionable.
    setStage('idle');
    if (verdict.status === 'invalid') {
      console.warn(`[update] check failed: ${verdict.reason}`);
      // Only a manual check surfaces the failure, because only then did
      // someone ask a question that deserves an answer.
      if (options.manual) setError('Could not check for updates. Please try again later.');
    } else if (options.manual && verdict.status === 'up-to-date') {
      setUpToDate(true);
    }
  }, []);

  // Automatic check. Deliberately NOT in RootNavigator's bootstrap: that gates
  // `isReady` behind a spinner (so anything awaited there becomes cold-start
  // latency) and its blanket catch defaults to the Auth stack — a network hiccup
  // during an update check would log the user out.
  useEffect(() => {
    if (!auto || autoCheckDone) return;
    if (Platform.OS !== 'android' || !UPDATES_SUPPORTED) return;
    autoCheckDone = true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => void runCheck({ manual: false }), STARTUP_DELAY_MS);
    });

    return () => {
      interaction.cancel();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const startDownload = useCallback(async () => {
    if (!manifest) return;

    const target = downloadPath(manifest.versionCode);
    setError(null);
    setProgress(null);
    setStage('downloading');

    try {
      // Reuse an intact prior download. Common after the user hit the
      // "install unknown apps" wall, fixed the toggle, and came back.
      if (await isUsable(target, manifest)) {
        await fireInstall(target, setStage, setError);
        return;
      }

      const task = ReactNativeBlobUtil.config({
        // Must be the cache or document dir — those are the paths the merged
        // provider_paths.xml exposes, and actionViewIntent can only produce a
        // content:// URI for a file the FileProvider can see.
        path: target,
        overwrite: true,
        // Follow the CDN/nginx redirect if there ever is one.
        followRedirect: true,
      }).fetch('GET', manifest.apkUrl);

      taskRef.current = task;

      task.progress({ interval: 250 }, (received, total) => {
        if (!mountedRef.current) return;
        // total is -1 when the server sends no Content-Length; null drives an
        // indeterminate bar rather than a fake one stuck at 0%.
        setProgress(total > 0 ? Number(received) / Number(total) : null);
      });

      const res = await task;
      taskRef.current = null;
      if (!mountedRef.current) return;

      const status = res.info().status;
      if (status < 200 || status >= 300) {
        throw new Error(`Download failed (HTTP ${status})`);
      }

      setStage('verifying');
      if (!(await isUsable(target, manifest))) {
        throw new Error('The downloaded file failed its integrity check.');
      }

      await fireInstall(target, setStage, setError);
    } catch (err) {
      taskRef.current = null;
      if (!mountedRef.current) return;
      // Leave nothing half-written to be mistaken for a good download later.
      await ReactNativeBlobUtil.fs.unlink(target).catch(() => {});
      setStage('failed');
      setError(err instanceof Error ? err.message : 'The update could not be downloaded.');
    }
  }, [manifest]);

  const dismiss = useCallback(() => {
    if (manifest) void updateStorage.setDismissedCode(manifest.versionCode);
    taskRef.current?.cancel(() => {});
    taskRef.current = null;
    setStage('idle');
    setManifest(null);
    setProgress(null);
  }, [manifest]);

  const checkNow = useCallback(() => runCheck({ manual: true }), [runCheck]);

  return {
    stage,
    manifest,
    progress,
    error,
    upToDate,
    checkNow,
    startDownload,
    dismiss,
    openInstallSettings,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * The versionCode is in the filename so a stale partial from a previous release
 * can never masquerade as the current one.
 */
function downloadPath(versionCode: number): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/unix-update-${versionCode}.apk`;
}

/**
 * Two checks, cheapest first.
 *
 * Size is instant and kills the case that actually happens — nginx answering a
 * missing/renamed APK with the Centrix SPA's index.html, which downloads happily
 * as a few KB of HTML. The hash then catches a file spliced mid-publish, since
 * the APK is overwritten in place. Android's own signature verification is the
 * real security backstop; neither of these is a security control.
 */
async function isUsable(path: string, manifest: UpdateManifest): Promise<boolean> {
  try {
    if (!(await ReactNativeBlobUtil.fs.exists(path))) return false;

    if (manifest.sizeBytes) {
      const stat = await ReactNativeBlobUtil.fs.stat(path);
      if (Number(stat.size) !== manifest.sizeBytes) return false;
    }

    if (manifest.sha256) {
      const digest = await ReactNativeBlobUtil.fs.hash(path, 'sha256');
      if (digest.toLowerCase() !== manifest.sha256.toLowerCase()) return false;
    }

    // With neither field published there is nothing left to check; the download
    // succeeded and Android will reject a corrupt APK at install time.
    return true;
  } catch {
    return false;
  }
}

/**
 * Hands the APK to the system package installer.
 *
 * `chooserTitle` is deliberately omitted — supplying it wraps the intent in
 * `createChooser`, which is wrong for an install and shows an app picker.
 *
 * Critically, this promise resolves as soon as the installer LAUNCHES. The app
 * can never learn the outcome: on success it is killed and replaced by the new
 * build. So return to idle and close the prompt — never await a result that will
 * not arrive.
 */
async function fireInstall(
  path: string,
  setStage: (s: UpdateStage) => void,
  setError: (e: string | null) => void,
): Promise<void> {
  setStage('launching');
  try {
    await ReactNativeBlobUtil.android.actionViewIntent(
      path,
      'application/vnd.android.package-archive',
    );
    setStage('idle');
  } catch {
    // Almost always the per-app "Allow from this source" toggle, which is off by
    // default. The manifest permission is install-time and cannot be revoked, but
    // Android 8+ runs its own consent funnel on top of it — and there is no way
    // to pre-check canRequestPackageInstalls() without writing a native module.
    // Hence: optimistic, then recoverable.
    setStage('failed');
    setError(
      'Android blocked the install. Allow this app to install unknown apps, then tap Retry.',
    );
  }
}

/**
 * Opens the "install unknown apps" settings screen.
 *
 * Honest limitation: `sendIntent` cannot attach a `package:` data URI, so this
 * lands on the app LIST rather than Unix's own toggle. The user still has to find
 * the app. It beats "go to Settings and look around", which is the alternative.
 */
async function openInstallSettings(): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.MANAGE_UNKNOWN_APP_SOURCES');
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}

/**
 * Deletes cached APKs that can no longer be useful.
 *
 * Runs on check rather than after firing the intent: at that moment the system
 * installer may still be reading the file, and deleting it would fail the install
 * the user just approved. ~40 MB per stale file is worth reclaiming.
 */
async function cleanStaleDownloads(keepVersionCode: number): Promise<void> {
  try {
    const dir = ReactNativeBlobUtil.fs.dirs.CacheDir;
    const entries = await ReactNativeBlobUtil.fs.ls(dir);
    await Promise.all(
      entries
        .filter((name) => /^unix-update-\d+\.apk$/.test(name))
        .filter((name) => Number(name.match(/\d+/)?.[0]) !== keepVersionCode)
        .map((name) => ReactNativeBlobUtil.fs.unlink(`${dir}/${name}`).catch(() => {})),
    );
  } catch {
    // Cache hygiene only — never worth surfacing.
  }
}
