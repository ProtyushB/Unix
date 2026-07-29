# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# react-native-config reads the baked .env values by REFLECTION — see
# RNCConfigModuleImpl.java:43, `Class.forName(packageName + ".BuildConfig")` followed by
# getDeclaredFields(). R8 cannot see a reflective lookup, so with minifyEnabled on it
# concluded BuildConfig was unused and stripped the class outright.
#
# The failure is silent, which is what makes it dangerous: the module catches the
# ClassNotFoundException, logs "Could not find BuildConfig class" to logcat and returns an
# empty map. src/config/env.ts then falls back to its localhost defaults, so a release APK
# quietly points at http://localhost:8085 on the phone instead of the real backends. Nothing
# fails at build time and the APK installs and launches normally.
#
# Keep the whole class: the module enumerates the fields rather than naming them, so keeping
# only some would strip whichever key was added last.
-keep class com.unixtemp.BuildConfig { *; }
