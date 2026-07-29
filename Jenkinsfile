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
                    // which environment the APK talks to — getting it wrong is not cosmetic.
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
                }
                sh 'cp /var/lib/jenkins/.android/unix-release-key.keystore android/app/unix-release-key.keystore'
                dir('android') {
                    sh 'chmod +x gradlew'
                    sh './gradlew assembleRelease --no-daemon'
                }
            }
        }

        stage('Verify Baked URLs') {
            steps {
                script {
                    // Staging the right .env is necessary but NOT sufficient: react-native-config
                    // reads those values by reflection, so R8 silently stripped BuildConfig and
                    // every release APK fell back to the localhost defaults in src/config/env.ts.
                    // Nothing failed — the build was green, the APK installed, and it simply
                    // talked to nothing. Assert the URLs survived minification instead of trusting
                    // that they did.
                    def branch = (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
                    def expected, wrong
                    if (branch == 'dev')       { expected = 'auth.dev.eternitytechnologies.in';  wrong = 'auth.live.eternitytechnologies.in' }
                    else if (branch == 'live') { expected = 'auth.live.eternitytechnologies.in'; wrong = 'auth.dev.eternitytechnologies.in'  }
                    else { error("Refusing to verify an unexpected branch '${branch}'") }

                    sh """
                        set -e
                        rm -rf verify-apk && mkdir verify-apk
                        unzip -qo android/app/build/outputs/apk/release/app-release.apk 'classes*.dex' -d verify-apk

                        grep -aq '${expected}' verify-apk/classes*.dex || {
                            echo "FAIL: '${expected}' is not baked into the APK."
                            echo "R8 has most likely stripped com.unixtemp.BuildConfig again — react-native-config"
                            echo "reads it reflectively, so it needs the -keep rule in android/app/proguard-rules.pro."
                            exit 1
                        }

                        if grep -aq '${wrong}' verify-apk/classes*.dex; then
                            echo "FAIL: the APK also contains '${wrong}' — the wrong .env was staged."
                            exit 1
                        fi

                        echo "OK: APK is baked against ${expected}"
                    """
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

                    echo "Publishing APK -> /opt/centrix${suffix}/downloads/unix.apk"
                    sh "mkdir -p /opt/centrix${suffix}/downloads"
                    sh "cp android/app/build/outputs/apk/release/app-release.apk /opt/centrix${suffix}/downloads/unix.apk"
                    sh "chmod 644 /opt/centrix${suffix}/downloads/unix.apk"
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
