import Config from 'react-native-config';

/**
 * The running build's own identity, and where the updater looks for a newer one.
 *
 * Unix ships as a self-hosted APK from centrixpro.in rather than through the Play
 * Store, so Play's in-app-update API does not apply and the app has to compare
 * versions itself. Everything here feeds that comparison.
 *
 * Soft defaults on purpose — this deliberately follows `features.ts`, NOT the
 * throwing pattern of `env.ts`. A missing backend URL means the app cannot
 * function and should refuse to start; a missing version just means the updater
 * self-disables. Bricking the app over an optional convenience would be a far
 * worse failure than never offering an update.
 */

/**
 * versionCode / versionName come from `android/app/build.gradle`, where Jenkins
 * sets them per build (`-PversionCode -PversionName`).
 *
 * They are readable from JS without any `.env` key because `react-native-config`
 * does not read `.env` at runtime at all — it reflects over the generated
 * BuildConfig class and copies EVERY declared field
 * (`RNCConfigModuleImpl.getDeclaredFields()`), and AGP always emits VERSION_CODE
 * and VERSION_NAME there. Baking a separate `APP_VERSION_CODE` into `.env` was
 * the obvious alternative and is worse: it creates two independent CI inputs
 * that must agree forever, and drift fails silently in both directions — too
 * high permanently kills the updater, too low loops the user through installing
 * the same build forever.
 *
 * ⚠️ If the updater works in debug but no-ops in release, suspect R8 first. This
 * reflective read is exactly what R8 broke once before, stripping BuildConfig so
 * every release APK silently fell back to localhost. The existing
 * `-keep class com.unixtemp.BuildConfig { *; }` in `android/app/proguard-rules.pro`
 * covers these fields too, and the Jenkinsfile's Verify stage proves it per build.
 */
export const APP_VERSION_CODE = Number(Config.VERSION_CODE ?? 0) || 0;

/**
 * Display-only ("1.0.0-42"). Never compare versions with this — see below.
 *
 * `||`, not `??`: react-native-config returns an empty string for an absent key
 * (the web stub proxies missing keys to '', and a stripped BuildConfig reads the
 * same way), and `'' ?? 'unknown'` is still ''. That rendered the Account row
 * blank instead of "unknown" — defeating the one diagnostic that tells you R8
 * has stripped the version fields.
 */
export const APP_VERSION_NAME = String(Config.VERSION_NAME || 'unknown');

/**
 * Where the published release manifest lives, baked per environment.
 *
 * Empty disables the updater. That matters operationally: dev and live share
 * `applicationId com.unixtemp` and one signing keystore, so a live APK installs
 * straight over a dev one. If a dev build pointed at the live manifest, the
 * updater would silently migrate dev users onto production backends with their
 * dev-era storage intact. The Jenkinsfile asserts the correct host is baked in.
 *
 * Note this is NOT the emergency kill switch. Blanking the value only affects
 * builds made afterwards, which is useless during an incident — installed apps
 * keep the old value baked in. The real kill switch is renaming
 * `unix-manifest.json` on the server: every client then reads a non-manifest and
 * silently stops offering within one throttle window. That is precisely why the
 * parsing in `updateService.ts` is as defensive as it is — please do not
 * "simplify" it away.
 */
export const UPDATE_MANIFEST_URL = String(Config.UPDATE_MANIFEST_URL ?? '').trim();

/**
 * Whether the updater should run at all.
 *
 * `APP_VERSION_CODE > 0` is load-bearing: 0 means the build could not read its
 * own version, and a build that does not know its version cannot safely decide
 * that a remote one is newer — it would treat every published release as an
 * upgrade and prompt forever. Unknown version means stay quiet.
 */
export const UPDATES_SUPPORTED = APP_VERSION_CODE > 0 && UPDATE_MANIFEST_URL !== '';
