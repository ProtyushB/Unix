import { evaluateManifest } from './updateService';

/**
 * Tests for the updater's decision logic.
 *
 * Every rejection here is load-bearing. The updater's failure modes are quiet by
 * design — a wrong answer does not throw, it either offers an update that should
 * not exist or silently stops offering real ones — so the boundaries are worth
 * pinning down explicitly.
 */

const MANIFEST_URL = 'https://dev.centrixpro.in/downloads/unix-manifest.json';
const APK_URL = 'https://dev.centrixpro.in/downloads/unix.apk';

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    versionCode: 1042,
    versionName: '0.0.1-42',
    apkUrl: APK_URL,
    releasedAt: '2026-07-30T10:00:00Z',
    sizeBytes: 41234567,
    sha256: 'a'.repeat(64),
    minSupportedVersionCode: 0,
    notes: [],
    ...overrides,
  });
}

describe('evaluateManifest — version comparison', () => {
  it('offers a strictly newer build', () => {
    const verdict = evaluateManifest(manifestJson(), 1001, MANIFEST_URL);
    expect(verdict.status).toBe('update-available');
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.versionCode).toBe(1042);
      expect(verdict.manifest.apkUrl).toBe(APK_URL);
    }
  });

  it('says nothing when the versions are equal — the steady state for every up-to-date device', () => {
    expect(evaluateManifest(manifestJson(), 1042, MANIFEST_URL).status).toBe('up-to-date');
  });

  it('says nothing when the published build is older, rather than offering a downgrade', () => {
    expect(evaluateManifest(manifestJson(), 2000, MANIFEST_URL).status).toBe('up-to-date');
  });
});

describe('evaluateManifest — unknown local version', () => {
  // A build that cannot read its own versionCode must stay silent: it would
  // treat every published release as an upgrade and prompt forever.
  it.each([0, -1, 1.5, NaN])('reports unsupported for currentCode %p', (code) => {
    expect(evaluateManifest(manifestJson(), code, MANIFEST_URL).status).toBe('unsupported');
  });
});

describe('evaluateManifest — malformed bodies', () => {
  // The case that actually happens: nginx serves the Centrix SPA's index.html
  // for unmatched paths, so an unpublished (or deliberately renamed) manifest
  // arrives as 200 + HTML rather than a 404.
  it('rejects the SPA index.html served in place of a manifest', () => {
    const verdict = evaluateManifest(
      '<!doctype html><html><head><title>Centrix</title></head><body></body></html>',
      1001,
      MANIFEST_URL,
    );
    expect(verdict.status).toBe('invalid');
  });

  it('rejects an empty object', () => {
    expect(evaluateManifest('{}', 1001, MANIFEST_URL).status).toBe('invalid');
  });

  it('rejects a JSON array', () => {
    expect(evaluateManifest('[]', 1001, MANIFEST_URL).status).toBe('invalid');
  });

  it('rejects an empty body', () => {
    expect(evaluateManifest('', 1001, MANIFEST_URL).status).toBe('invalid');
  });

  // A string versionCode is a publish bug. Coercing it would silently turn the
  // comparison lexicographic, where "1042" < "999".
  it('rejects a string versionCode rather than coercing it', () => {
    const verdict = evaluateManifest(manifestJson({ versionCode: '1042' }), 1001, MANIFEST_URL);
    expect(verdict.status).toBe('invalid');
  });

  it.each([0, -5, 10.5])('rejects versionCode %p', (code) => {
    expect(evaluateManifest(manifestJson({ versionCode: code }), 1001, MANIFEST_URL).status).toBe(
      'invalid',
    );
  });

  it('rejects a missing apkUrl', () => {
    expect(evaluateManifest(manifestJson({ apkUrl: undefined }), 1001, MANIFEST_URL).status).toBe(
      'invalid',
    );
  });
});

describe('evaluateManifest — apkUrl guards', () => {
  it('rejects a plain-http apkUrl', () => {
    const verdict = evaluateManifest(
      manifestJson({ apkUrl: 'http://dev.centrixpro.in/downloads/unix.apk' }),
      1001,
      MANIFEST_URL,
    );
    expect(verdict.status).toBe('invalid');
  });

  // The guard that matters most. dev and live share applicationId com.unixtemp
  // and one signing keystore, so a live APK installs straight over a dev one —
  // a cross-origin apkUrl would silently move a dev user onto production.
  it('rejects an apkUrl on a different origin than the manifest', () => {
    const verdict = evaluateManifest(
      manifestJson({ apkUrl: 'https://live.centrixpro.in/downloads/unix.apk' }),
      1001,
      MANIFEST_URL,
    );
    expect(verdict.status).toBe('invalid');
    if (verdict.status === 'invalid') expect(verdict.reason).toMatch(/same-origin/);
  });

  it('rejects an unparseable apkUrl', () => {
    expect(evaluateManifest(manifestJson({ apkUrl: 'not a url' }), 1001, MANIFEST_URL).status).toBe(
      'invalid',
    );
  });
});

describe('evaluateManifest — optional fields', () => {
  // Optional and only trusted when sane: a bad sizeBytes would fail every
  // download's post-check and make the updater permanently unusable, which is
  // worse than simply not having the check.
  it('drops a nonsense sizeBytes instead of failing the whole manifest', () => {
    const verdict = evaluateManifest(manifestJson({ sizeBytes: -1 }), 1001, MANIFEST_URL);
    expect(verdict.status).toBe('update-available');
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.sizeBytes).toBeUndefined();
    }
  });

  it('drops a malformed sha256 instead of failing the whole manifest', () => {
    const verdict = evaluateManifest(manifestJson({ sha256: 'nope' }), 1001, MANIFEST_URL);
    expect(verdict.status).toBe('update-available');
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.sha256).toBeUndefined();
    }
  });

  it('keeps a well-formed sha256', () => {
    const verdict = evaluateManifest(manifestJson(), 1001, MANIFEST_URL);
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.sha256).toBe('a'.repeat(64));
    }
  });

  it('falls back to the versionCode when versionName is missing', () => {
    const verdict = evaluateManifest(manifestJson({ versionName: 42 }), 1001, MANIFEST_URL);
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.versionName).toBe('1042');
    }
  });

  it('keeps only string entries in notes', () => {
    const verdict = evaluateManifest(
      manifestJson({ notes: ['Fixed a bug', 7, null, 'And another'] }),
      1001,
      MANIFEST_URL,
    );
    if (verdict.status === 'update-available') {
      expect(verdict.manifest.notes).toEqual(['Fixed a bug', 'And another']);
    }
  });
});
