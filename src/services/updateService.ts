/**
 * Release-manifest fetching and evaluation for the self-hosted APK updater.
 *
 * Deliberately free of every React Native import so `evaluateManifest` can be
 * unit tested under plain jest, with no RN preset to wire up. Anything that
 * needs a native module (downloading, hashing, firing the install intent) lives
 * in `useAppUpdate.ts` instead. Keep it that way — the parsing rules below are
 * the part most worth testing and the part most tempting to loosen.
 */

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releasedAt?: string;
  sizeBytes?: number;
  sha256?: string;
  minSupportedVersionCode?: number;
  notes?: string[];
}

export type ManifestVerdict =
  | {status: 'update-available'; manifest: UpdateManifest}
  | {status: 'up-to-date'}
  | {status: 'unsupported'}
  | {status: 'invalid'; reason: string};

/** Milliseconds before a manifest fetch is abandoned. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Decides whether a fetched body describes an update worth offering.
 *
 * Pure: takes the raw response text and the running build's version, returns a
 * verdict. Every rejection path is deliberate — see the notes inline. The
 * caller treats anything other than `update-available` as "say nothing".
 *
 * @param body            raw response text, NOT a parsed object
 * @param currentCode     this build's versionCode (0 = unknown)
 * @param manifestUrl     the URL the body came from, for the same-origin check
 */
export function evaluateManifest(
  body: string,
  currentCode: number,
  manifestUrl: string,
): ManifestVerdict {
  // A build that cannot read its own version cannot judge whether a remote one
  // is newer — it would treat every release as an upgrade, forever.
  if (!Number.isInteger(currentCode) || currentCode <= 0) {
    return {status: 'unsupported'};
  }

  let parsed: unknown;
  try {
    // JSON.parse in a try, never res.json(): nginx serves the Centrix SPA's
    // index.html for unmatched paths, so a manifest that has not been published
    // yet — or was renamed as the kill switch — arrives as 200 + HTML. res.json()
    // would reject with an unhandled promise; this reports it as ordinary
    // "nothing to offer".
    parsed = JSON.parse(body);
  } catch {
    return {status: 'invalid', reason: 'body is not JSON'};
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {status: 'invalid', reason: 'body is not a JSON object'};
  }

  const m = parsed as Record<string, unknown>;

  // Strict integer, and strictly a number: a string "1042" is a publish bug, and
  // accepting it would mean version comparison silently became lexicographic.
  if (typeof m.versionCode !== 'number' || !Number.isInteger(m.versionCode) || m.versionCode <= 0) {
    return {status: 'invalid', reason: 'versionCode must be a positive integer'};
  }

  if (typeof m.apkUrl !== 'string' || !m.apkUrl) {
    return {status: 'invalid', reason: 'apkUrl missing'};
  }

  // https only, and same origin as the manifest itself. The origin check is the
  // one that matters: it means a compromised or misconfigured manifest can only
  // ever point at the host that served it, so it can never redirect a device to
  // a third-party APK — or, far more likely in practice, hand a dev build the
  // live download and silently move that user onto production.
  let apkOrigin: string;
  let manifestOrigin: string;
  try {
    const apk = new URL(m.apkUrl);
    const manifest = new URL(manifestUrl);
    if (apk.protocol !== 'https:') {
      return {status: 'invalid', reason: 'apkUrl must be https'};
    }
    apkOrigin = apk.origin;
    manifestOrigin = manifest.origin;
  } catch {
    return {status: 'invalid', reason: 'apkUrl or manifestUrl is not a valid URL'};
  }
  if (apkOrigin !== manifestOrigin) {
    return {status: 'invalid', reason: 'apkUrl is not same-origin with the manifest'};
  }

  // Strictly greater. Equal is the steady state for every up-to-date device, and
  // lower means a rollback the client must not act on — reinstalling an older
  // build would just re-offer the newer one on next launch.
  if (m.versionCode <= currentCode) {
    return {status: 'up-to-date'};
  }

  return {
    status: 'update-available',
    manifest: {
      versionCode: m.versionCode,
      versionName: typeof m.versionName === 'string' ? m.versionName : String(m.versionCode),
      apkUrl: m.apkUrl,
      releasedAt: typeof m.releasedAt === 'string' ? m.releasedAt : undefined,
      // Optional, and only trusted when sane. sizeBytes earns its keep twice:
      // it is shown before a ~40 MB download on possibly-metered data, and a
      // length check after download kills the HTML-served-as-APK case with no
      // crypto involved.
      sizeBytes:
        typeof m.sizeBytes === 'number' && Number.isInteger(m.sizeBytes) && m.sizeBytes > 0
          ? m.sizeBytes
          : undefined,
      // Corruption detection, NOT a security control — the manifest and the APK
      // share a host and a TLS connection, so an attacker who can rewrite one can
      // rewrite the other. Its real job: the APK is overwritten in place on
      // publish, so a client downloading mid-publish gets a spliced file.
      sha256:
        typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256 : undefined,
      minSupportedVersionCode:
        typeof m.minSupportedVersionCode === 'number' ? m.minSupportedVersionCode : 0,
      notes: Array.isArray(m.notes) ? m.notes.filter((n): n is string => typeof n === 'string') : [],
    },
  };
}

/**
 * Fetches the manifest and evaluates it. Never throws.
 *
 * Uses bare `fetch`, never the app's axios instances. Those attach a JWT and
 * carry a 401 → refresh → clearAllAuth → navigate-to-Login interceptor; pointing
 * that at a static nginx host is wrong on its face, and a stray 401 from the
 * static host would log the user out mid-session.
 */
export async function fetchManifest(
  manifestUrl: string,
  currentCode: number,
): Promise<ManifestVerdict> {
  if (!manifestUrl) return {status: 'unsupported'};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(manifestUrl, {
      method: 'GET',
      signal: controller.signal,
      // The APK is overwritten in place and the manifest with it, so a cached
      // copy is exactly the thing that would hide a release.
      headers: {Accept: 'application/json', 'Cache-Control': 'no-cache'},
    });

    if (!res.ok) {
      return {status: 'invalid', reason: `HTTP ${res.status}`};
    }

    // The forgiving form: reject text/html rather than requiring
    // application/json. A host serving the manifest as text/plain is a
    // misconfiguration we can survive; the SPA fallback is the case that
    // actually happens and the one worth naming.
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.toLowerCase().includes('text/html')) {
      return {status: 'invalid', reason: 'server returned HTML (manifest not published?)'};
    }

    return evaluateManifest(await res.text(), currentCode, manifestUrl);
  } catch (err) {
    // Includes the abort. Offline is the common case and is not noteworthy.
    return {
      status: 'invalid',
      reason: err instanceof Error ? err.message : 'network error',
    };
  } finally {
    clearTimeout(timer);
  }
}
