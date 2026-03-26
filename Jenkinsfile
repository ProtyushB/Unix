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
                dir('android') {
                    sh 'chmod +x gradlew'
                    sh './gradlew assembleRelease --no-daemon'
                }
            }
        }

        stage('Publish APK') {
            steps {
                sh 'cp android/app/build/outputs/apk/release/app-release.apk /opt/centrix/downloads/unix.apk'
                sh 'chmod 644 /opt/centrix/downloads/unix.apk'
            }
        }
    }

    post {
        always {
            deleteDir()
        }
    }
}
