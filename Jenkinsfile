pipeline {
    agent any

    environment {
        ANDROID_HOME      = '/opt/android-sdk'
        ANDROID_SDK_ROOT  = '/opt/android-sdk'
        PATH              = "/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/35.0.0:${env.PATH}"
    }

    stages {
        stage('Install JS Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build Release APK') {
            steps {
                script {
                    // One Jenkinsfile serves both branches. Since commit 399408f the backend URLs
                    // come from .env rather than being hardcoded, so the file staged here decides
                    // which environment the APK talks to â€” getting it wrong is not cosmetic.
                    // Anything other than dev/live is refused rather than guessed at.
                    def branch = (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
                    def envFile
                    if (branch == 'dev')       { envFile = '/var/lib/jenkins/.envs/unix-dev.env' }
                    else if (branch == 'live') { envFile = '/var/lib/jenkins/.envs/unix-live.env' }
                    else { error("Refusing to build from unexpected branch '${branch}'") }

                    // react-native-config bakes .env into the binary at build time; the
                    // workspace is wiped each run, so stage the per-environment .env (kept as a
                    // secret on the box, same pattern as the keystore) into the repo root
                    // where dotenv.gradle reads it ($rootDir/../.env).
                    echo "Building branch '${branch}' with ${envFile}"
                    sh "test -f ${envFile} || { echo 'Missing ${envFile}'; exit 1; }"
                    sh "cp ${envFile} .env"

                    // Version the build. Until now versionCode/versionName were the scaffold
                    // literals (1 / "1.0") in build.gradle, so every APK ever published looked
                    // identical to the in-app updater. CI owns them now.
                    //
                    // versionCode must be monotonic â€” it is the ONLY value the updater compares.
                    // BUILD_NUMBER supplies monotonicity; the 1000 offset leaves room to re-base
                    // upward if this job is ever deleted/renamed (BUILD_NUMBER restarts at 1, and
                    // publishing a lower code than what is already installed would silently freeze
                    // every device forever â€” they would never again see a larger number).
                    //
                    // versionName is display-only. package.json owns the human-facing part, so
                    // bumping it is a deliberate release act; BUILD_NUMBER keeps builds distinct.
                    // git describe is not an option here: the repo has zero tags.
                    // Stored on env, not as local `def`s, because the Verify and Publish stages
                    // below both need them and each stage's script block is its own scope.
                    def pkgVersion = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                    env.APP_VERSION_CODE = (1000 + (env.BUILD_NUMBER as Integer)).toString()
                    env.APP_VERSION_NAME = "${pkgVersion}-${env.BUILD_NUMBER}"
                    echo "Version: ${env.APP_VERSION_NAME} (code ${env.APP_VERSION_CODE})"
                }
                sh 'cp /var/lib/jenkins/.android/unix-release-key.keystore android/app/unix-release-key.keystore'
                dir('android') {
                    sh 'chmod +x gradlew'
                    // -P rather than writing android/gradle.properties: the flags are visible in
                    // the build log, scoped to this one invocation, and never touch that file â€”
                    // which is git-tracked and holds the keystore credentials.
                    sh "./gradlew assembleRelease --no-daemon -PversionCode=${env.APP_VERSION_CODE} -PversionName=${env.APP_VERSION_NAME}"
                }
            }
        }

        stage('Verify Baked URLs') {
            steps {
                script {
                    // Staging the right .env is necessary but NOT sufficient: react-native-config
                    // reads those values by reflection, so R8 silently stripped BuildConfig and
                    // every release APK fell back to the localhost defaults in src/config/env.ts.
                    // Nothing failed â€” the build was green, the APK installed, and it simply
                    // talked to nothing. Assert the URLs survived minification instead of trusting
                    // that they did.
                    def branch = (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
                    def expected, wrong, expectedHost, wrongHost
                    if (branch == 'dev')       { expected = 'auth.dev.eternitytechnologies.in';  wrong = 'auth.live.eternitytechnologies.in'; expectedHost = 'dev.centrixpro.in';  wrongHost = 'live.centrixpro.in' }
                    else if (branch == 'live') { expected = 'auth.live.eternitytechnologies.in'; wrong = 'auth.dev.eternitytechnologies.in';  expectedHost = 'live.centrixpro.in'; wrongHost = 'dev.centrixpro.in'  }
                    else { error("Refusing to verify an unexpected branch '${branch}'") }

                    sh """
                        set -e
                        rm -rf verify-apk && mkdir verify-apk
                        unzip -qo android/app/build/outputs/apk/release/app-release.apk 'classes*.dex' -d verify-apk

                        grep -aq '${expected}' verify-apk/classes*.dex || {
                            echo "FAIL: '${expected}' is not baked into the APK."
                            echo "R8 has most likely stripped com.unixtemp.BuildConfig again â€” react-native-config"
                            echo "reads it reflectively, so it needs the -keep rule in android/app/proguard-rules.pro."
                            exit 1
                        }

                        if grep -aq '${wrong}' verify-apk/classes*.dex; then
                            echo "FAIL: the APK also contains '${wrong}' â€” the wrong .env was staged."
                            exit 1
                        fi

                        echo "OK: APK is baked against ${expected}"

                        # Same check for the update manifest URL. This one matters more than it looks:
                        # dev and live share applicationId com.unixtemp AND one keystore, so a live APK
                        # installs silently over a dev one. If a dev build pointed at the live manifest,
                        # the updater would quietly migrate dev users onto production backends.
                        grep -aq '${expectedHost}' verify-apk/classes*.dex || {
                            echo "FAIL: UPDATE_MANIFEST_URL for '${expectedHost}' is not baked into the APK."
                            echo "Check UPDATE_MANIFEST_URL exists in /var/lib/jenkins/.envs/unix-${branch}.env."
                            echo "Without it the in-app updater self-disables â€” silently, by design."
                            exit 1
                        }

                        if grep -aq '${wrongHost}' verify-apk/classes*.dex; then
                            echo "FAIL: the APK also contains '${wrongHost}' â€” the wrong .env was staged."
                            exit 1
                        fi

                        echo "OK: update manifest points at ${expectedHost}"
                    """

                    // Assert the version actually took. A typo'd -P property does not fail the build â€”
                    // build.gradle just falls back to its defaults â€” and the APK would publish as
                    // versionCode 1 while the manifest advertised 1042. Every client would then
                    // download, install, restart, and be offered the same update forever.
                    def badging = sh(script: "aapt dump badging android/app/build/outputs/apk/release/app-release.apk | head -1", returnStdout: true).trim()
                    echo badging
                    if (!(badging =~ /versionCode='${env.APP_VERSION_CODE}'/)) {
                        error("APK reports ${badging} but expected versionCode='${env.APP_VERSION_CODE}' â€” the -P properties did not reach build.gradle.")
                    }
                    echo "OK: APK reports versionCode ${env.APP_VERSION_CODE}"
                }
            }
        }

        stage('Publish APK') {
            steps {
                script {
                    def branch = (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
                    def suffix
                    if (branch == 'dev')       { suffix = '-dev' }
                    else if (branch == 'live') { suffix = '-live' }
                    else { error("Refusing to publish from unexpected branch '${branch}'") }

                    def host = (branch == 'dev') ? 'dev.centrixpro.in' : 'live.centrixpro.in'
                    def outDir = "/opt/centrix${suffix}/downloads"

                    // Refuse to go backwards. versionCode is the ONLY value the client compares, so
                    // publishing one lower than what devices already run freezes them permanently:
                    // they would never again see a number greater than their own. The likely cause is
                    // the Jenkins job being recreated (BUILD_NUMBER restarts at 1) â€” the fix is to
                    // raise the base offset in the build stage, not to bypass this check.
                    sh """
                        set -e
                        mkdir -p ${outDir}
                        if [ -f ${outDir}/unix-manifest.json ]; then
                            PUBLISHED=\$(node -p "require('${outDir}/unix-manifest.json').versionCode" 2>/dev/null || echo 0)
                            if [ "\$PUBLISHED" -ge "${env.APP_VERSION_CODE}" ]; then
                                echo "FAIL: ${outDir} already publishes versionCode \$PUBLISHED;"
                                echo "this build is ${env.APP_VERSION_CODE}. Publishing it would permanently freeze"
                                echo "every installed app. Raise the base offset in the Build stage instead."
                                exit 1
                            fi
                        fi
                    """

                    // APK first, manifest second â€” the manifest is what makes a release visible, so it
                    // must never advertise a build that is not yet downloadable.
                    echo "Publishing APK -> ${outDir}/unix.apk"
                    sh "cp android/app/build/outputs/apk/release/app-release.apk ${outDir}/unix.apk"
                    sh "chmod 644 ${outDir}/unix.apk"

                    // Built in shell rather than with groovy.json.JsonOutput + new Date(). Pipelines
                    // loaded from SCM run in the Groovy sandbox, where both are classic rejections
                    // requiring manual script approval â€” and that only surfaces at build time, on a
                    // stage that has already copied the APK into place.
                    //
                    // Written temp-then-mv so a client polling mid-publish never reads a half-written
                    // file. mv within a filesystem is atomic; cp is not.
                    //
                    // minSupportedVersionCode ships hard-wired to 0 and is read by nothing â€” it is
                    // here so a future forced-update tier needs no schema change. notes is [] because
                    // there is no changelog source (no tags, no CHANGELOG); the UI hides it when empty.
                    echo "Publishing manifest -> ${outDir}/unix-manifest.json"
                    sh """
                        set -e
                        SHA=\$(sha256sum ${outDir}/unix.apk | cut -d' ' -f1)
                        SIZE=\$(stat -c%s ${outDir}/unix.apk)
                        RELEASED=\$(date -u +'%Y-%m-%dT%H:%M:%SZ')

                        cat > ${outDir}/unix-manifest.json.tmp <<EOF
{
  "versionCode": ${env.APP_VERSION_CODE},
  "versionName": "${env.APP_VERSION_NAME}",
  "apkUrl": "https://${host}/downloads/unix.apk",
  "releasedAt": "\$RELEASED",
  "sizeBytes": \$SIZE,
  "sha256": "\$SHA",
  "minSupportedVersionCode": 0,
  "notes": []
}
EOF

                        # Parse it back before it goes live â€” a malformed manifest is indistinguishable
                        # from "no update" to the client, so it would fail completely silently.
                        node -e "JSON.parse(require('fs').readFileSync('${outDir}/unix-manifest.json.tmp','utf8'))"

                        chmod 644 ${outDir}/unix-manifest.json.tmp
                        mv -f ${outDir}/unix-manifest.json.tmp ${outDir}/unix-manifest.json
                        cat ${outDir}/unix-manifest.json
                    """
                }
            }
        }
    }

    post {
        always {
            deleteDir()
        }
    }
}
