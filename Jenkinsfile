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

        stage('Publish APK') {
            steps {
                script {
                    def branch = (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
                    def suffix
                    if (branch == 'dev')       { suffix = '-dev' }
                    else if (branch == 'live') { suffix = '' }
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
