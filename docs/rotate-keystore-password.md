# Rotating the release keystore password

The old password was committed to this **public** repo, so treat it as known. This
changes the password **without changing the signing key**, so every installed device
keeps accepting updates. Roughly two minutes.

> **Why you run this and not an assistant.** The new password must not exist in a chat
> transcript, a tool log, or shell history — those are exactly the kinds of places the
> old one leaked from. Every command below prompts interactively so nothing is echoed.

## Facts established before you start

- Keystore: `android/app/unix-release-key.keystore`, type **PKCS12**, alias
  `unix-release-key`, valid until 2053.
- Backup taken: `~/keystore-backups/unix-release-key.keystore.bak-20260806`
  (verified byte-identical, outside any git repo).
- Current key fingerprint — this is what must not change:

  ```
  SHA256: C1:20:77:DA:66:72:9F:E6:25:D5:F8:18:AF:8B:26:9F:63:15:23:53:09:DB:EA:C9:D7:0B:A3:46:B2:6E:DA:88
  ```

## PKCS12 has ONE password, not two

`keytool -keypasswd` does **not** work here:

```
keytool error: java.lang.UnsupportedOperationException:
  -keypasswd commands not supported if -storetype is PKCS12
```

Only `-storepasswd` is needed, and afterwards
`MYAPP_RELEASE_STORE_PASSWORD` and `MYAPP_RELEASE_KEY_PASSWORD` must be set to the
**same** new value. (Both were already the same string, so nothing changes in shape.)

## 1. Change it

`keytool` lives in the Android Studio JBR. From `android/app`:

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" -storepasswd -keystore unix-release-key.keystore
```

It prompts for the current password, then the new one twice. Do **not** pass
`-storepass` or `-new` — those land in shell history.

## 2. Prove the signing identity survived

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" -list -v -keystore unix-release-key.keystore | grep SHA256
```

The SHA256 must match the fingerprint above **exactly**. If it does not, stop and
restore from `~/keystore-backups/` — do not build or publish anything.

## 3. Update the two machines

Workstation — `~/.gradle/gradle.properties`:

```
MYAPP_RELEASE_STORE_FILE=unix-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=unix-release-key
MYAPP_RELEASE_STORE_PASSWORD=<new>
MYAPP_RELEASE_KEY_PASSWORD=<new>
```

CI — `/var/lib/jenkins/.gradle/gradle.properties`, same four lines,
`chown jenkins:jenkins`, `chmod 600`. Gradle merges this automatically; nothing is
passed on the command line, so it never reaches the build log.

Also replace the keystore Jenkins stages from
`/var/lib/jenkins/.android/unix-release-key.keystore` with the re-passworded file.

## 4. Confirm a real release build still signs

```bash
cd android && ./gradlew assembleRelease
```

Then check the APK carries the same key:

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" -printcert -jarfile app/build/outputs/apk/release/app-release.apk | grep SHA256
```

Same fingerprint again. That is the end-to-end proof: new password, same identity,
devices unaffected.

## 5. Afterwards

Delete `~/keystore-backups/unix-release-key.keystore.bak-20260806` once step 4 passes,
or move it to wherever you keep the canonical offline copy. It still opens with the
**old, public** password, so it is the weakest copy in existence until it is gone.

The old password remains in git history (`0503aac`, `6b86641`). Once this is done that
no longer matters — it unlocks nothing.
