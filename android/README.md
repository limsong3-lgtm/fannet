# Fannet Gamma: Android test build

A thin Android wrapper around the Gamma app pages, for testing on real phones.

- `app/src/main/assets/www/`: the Gamma pages (hub, Fan, Athlete, Manager, Promoter, Officials and the club mock-ups).
- Live records come from the Fannet master database (Supabase) through four read-only database functions:
  `fn_app_search`, `fn_app_person`, `fn_app_event` and `fn_app_comm_events`. The app uses the public, read-only key.
- Pages are served from `https://appassets.androidplatform.net/assets/www/` inside the app (WebViewAssetLoader).

## Build

Every push to the `android-apk` branch that touches `android/` builds a debug APK on GitHub Actions
(`.github/workflows/android-apk.yml`) and attaches it to the **android-latest** release as `fannet-gamma.apk`.

Locally: `gradle -p android assembleDebug` (needs the Android SDK, Java 17 and Gradle 8.9).

## Install on a phone

Open the android-latest release on the phone, download `fannet-gamma.apk`, open it, and allow installing apps from that source when Android asks.
