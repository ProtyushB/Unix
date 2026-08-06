# Release keystore password — rotated 2026-08-06

**Done.** The password that was committed to this public repo no longer opens the
keystore. The signing key is unchanged, so every installed device still accepts
updates. This file is the record and the procedure if it ever needs repeating.

## What was wrong

`android/gradle.properties` carried `MYAPP_RELEASE_STORE_PASSWORD` and
`MYAPP_RELEASE_KEY_PASSWORD` as literal values, and `App Deployment.txt` repeated
one of them in prose. This repository is public, so both were world-readable from
commits `0503aac` and `6b86641` onward, and remain in history.

The keystore itself was never exposed — `*.keystore` is gitignored and no release
keystore appears anywhere in history — so what leaked was one half of a two-part
secret. That still mattered: this app self-hosts its APK updates and compares only
`versionCode`, so a compromised signing key cannot be rotated without every
installed device uninstalling and reinstalling. The key file was the single thing
standing between "fine" and "unrecoverable".

## What was done

1. Keystore backed up locally and on the CI box; all three copies verified
   byte-identical first (`d4a5cc47…`).
2. New 32-character alphanumeric password generated with `openssl rand` straight
   into a mode-600 file — never echoed to a terminal, a log, or a transcript.
3. `keytool -storepasswd` applied. Old password confirmed **rejected** afterwards.
4. Fingerprint confirmed unchanged:
   `C1:20:77:DA:66:72:9F:E6:25:D5:F8:18:AF:8B:26:9F:63:15:23:53:09:DB:EA:C9:D7:0B:A3:46:B2:6E:DA:88`
5. Credentials written to both Gradle homes; rotated keystore uploaded to CI.
6. Verified on the server, running **as the `jenkins` user**, that the CI
   credentials open the CI keystore and yield that same fingerprint.
7. Real `assembleRelease` built and the APK's signature checked:
   `V2 Signer: certificate SHA-256 digest: c12077da…b26eda88` — identical.
8. Both old-password backups shredded.

## Where the password lives now

    ~/.gradle/gradle.properties                  (workstation)
    /var/lib/jenkins/.gradle/gradle.properties   (CI, jenkins:jenkins, 0600)

Gradle merges these into project properties automatically, so nothing is passed
on the command line and nothing reaches the Jenkins build log. It is deliberately
**not** recorded anywhere else — read it from one of those two files.

## Verifying at any time

    keytool -list -v -keystore android/app/unix-release-key.keystore

    # v1 JAR signing is off, so keytool -printcert -jarfile prints NOTHING.
    # Use apksigner for a built APK:
    apksigner verify --print-certs app-release.apk

Both must show the fingerprint above.

## If it ever needs repeating

This keystore is **PKCS12**, which keeps one password rather than a store password
plus a per-key password:

    keytool error: java.lang.UnsupportedOperationException:
      -keypasswd commands not supported if -storetype is PKCS12

So `-storepasswd` alone, then set both `MYAPP_RELEASE_STORE_PASSWORD` and
`MYAPP_RELEASE_KEY_PASSWORD` to the same value. Run it without `-storepass`/`-new`
so the value is prompted rather than left in shell history, and diff the
fingerprint before and after.

Take a backup first — but **not next to the original**. `*.keystore` does not match
`unix-release-key.keystore.bak-20260806`, so a backup taken in `android/app/` shows
up as an ordinary untracked file, one `git add -A` from publishing the signing key.
`.gitignore` now covers the suffixed variants, and the backup belongs outside the
repo regardless.
