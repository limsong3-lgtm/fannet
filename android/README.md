# Fannet: Android test build

A thin Android app that shows the live Fannet app (https://app.fannet.co) full screen.

- Nothing is bundled: every web release on app.fannet.co is in the phone app at once, and the screens are exactly the web screens.
- Sign-in, records and follows work as on the web (email sign-in code, the signed-in readers in fannet-db.js).
- Links to other sites, email and messages open outside the app. With no connection the app shows a "Try again" page.

## Build

Builds are manual (Lim, 2026-10-26): GitHub > Actions > "Android APK" > Run workflow.
The run attaches `fannet-gamma.apk` to the **android-latest** release.

Locally: `gradle -p android assembleDebug` (needs the Android SDK, Java 17 and Gradle 8.9).

## Install on a phone

Open https://github.com/limsong3-lgtm/fannet/releases/tag/android-latest on the phone, download `fannet-gamma.apk`, open it,
and allow installing apps from that source when Android asks. If an older "Fannet Gamma" test app is on the phone, uninstall it first
(each test build is signed with a new test key, so Android refuses to install over it).
