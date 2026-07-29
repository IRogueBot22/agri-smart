# AgriSmart AI — Flutter client

Native Android/iOS client for AgriSmart AI. It talks to the **same backend** as the
web app (Postgres + Auth + Storage), uses Open-Meteo directly for live weather,
and calls the deployed web app's server functions for AI features.

> This folder is source-only. It does **not** build or preview inside Lovable.
> Export the project to GitHub, then build it locally with the Flutter SDK.

---

## 1. Prerequisites

- Flutter 3.22+ (`flutter doctor` must be clean)
- Android Studio + JDK 17 (Android) / Xcode 15+ and CocoaPods (iOS, macOS only)
- A Google Maps API key (Android + iOS SDK enabled)

## 2. Setup

```bash
cd flutter_app
flutter pub get
```

## 3. Configuration (no secrets in source)

All config is read via `--dart-define`. Values come from your Lovable project's
`.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://<your-project>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable key> \
  --dart-define=API_BASE_URL=https://farmflow-ai-advisor.lovable.app \
  --dart-define=GOOGLE_MAPS_API_KEY=<maps key>
```

Tip: put those flags in a `run.sh` or use VS Code `launch.json` `toolArgs`.

### Google Maps native keys

Android — `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
```

iOS — `ios/Runner/AppDelegate.swift`:

```swift
GMSServices.provideAPIKey("YOUR_KEY")
```

## 4. Permissions

Android — `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

iOS — `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key><string>Photograph crop leaves for disease detection.</string>
<key>NSPhotoLibraryUsageDescription</key><string>Select leaf photos for disease detection.</string>
<key>NSLocationWhenInUseUsageDescription</key><string>Map your fields and give live weather advisories.</string>
```

## 5. Build

```bash
flutter build apk --release   # Android APK
flutter build appbundle       # Play Store AAB
flutter build ios --release   # iOS (then archive in Xcode)
```

## 6. What's implemented

| Screen | File | Data source |
| --- | --- | --- |
| Splash | `lib/screens/splash_screen.dart` | — |
| Onboarding | `lib/screens/onboarding_screen.dart` | local prefs |
| Login / Register | `lib/screens/auth_screen.dart` | Auth (email + Google) |
| Dashboard | `lib/screens/home_screen.dart` | live weather + fields |
| Fields list | `lib/screens/fields_screen.dart` | `fields` table |
| Field map draw | `lib/screens/field_draw_screen.dart` | Google Maps + area calc |
| Live weather | `lib/screens/weather_screen.dart` | Open-Meteo (direct) |
| AI advisor | `lib/screens/advisor_screen.dart` | server functions |
| Disease detection | `lib/screens/disease_screen.dart` | camera + Storage + AI |
| Market prices | `lib/screens/market_screen.dart` | `market_prices` table |
| Schemes | `lib/screens/schemes_screen.dart` | `government_schemes` table |
| Profile | `lib/screens/profile_screen.dart` | `profiles` table |

AI keys never ship in the app: `lib/services/ai_service.dart` posts to the
deployed web app's server functions, which hold the credentials server-side.

## 7. Remaining backend step

`lib/services/ai_service.dart` posts to `/api/public/ai/advise`, `/api/public/ai/disease` and
`/api/ai/chat` on the deployed web app. Those HTTP routes don't exist yet — the
web app currently exposes the same logic as internal server functions
(`src/lib/advisor.functions.ts`). Ask me to add the matching
`src/routes/api/ai/*.ts` handlers (bearer-token verified) and the Flutter AI
screens will work end-to-end.

---

## 6. GPS field mapping

The draw screen (`lib/screens/field_draw_screen.dart`) uses `geolocator`:

- Auto-centres on your live GPS fix at zoom 18 and shows an accuracy halo.
- **Follow** toggle in the app bar keeps the camera locked to your position
  (auto-releases when you pan the map manually).
- **Corner here** FAB drops a vertex at the exact GPS reading — walk the
  boundary and tap once per corner.
- **0.5 / 1 / 2 acre here** buttons generate a square boundary centred on you.
- Opening a field from *My Fields* (tap the row or the edit icon) loads its
  saved polygon for reshaping and calls `updateField(...)` on save; new fields
  call `createField(...)`. Both persist polygon, centroid and computed acres.

## 7. Camera & gallery

`lib/services/media_service.dart` wraps `image_picker` with a camera/gallery
bottom sheet and friendly permission errors. The disease screen sends the
chosen file to `POST /api/public/ai/disease-scan` as multipart, which stores
it and returns the structured diagnosis. Required permissions are listed in
section 4 (Android `CAMERA`, iOS `NSCameraUsageDescription` +
`NSPhotoLibraryUsageDescription`).

## 8. Firebase Cloud Messaging (push alerts)

### Client setup

1. Create a Firebase project and add both apps (Android package + iOS bundle).
2. Install the FlutterFire CLI and generate platform config:

   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```

   This writes `android/app/google-services.json` and
   `ios/Runner/GoogleService-Info.plist`.
3. Android: add the Google services plugin
   (`com.google.gms.google-services`) in `android/settings.gradle` and
   `android/app/build.gradle`, and keep
   `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`.
4. iOS: enable **Push Notifications** and **Background Modes → Remote
   notifications** in Xcode, and upload your APNs auth key in Firebase
   console → Cloud Messaging.
5. Run with `--dart-define=ENABLE_PUSH=false` to build without Firebase.

`lib/services/push_service.dart` requests permission, renders foreground
messages through `flutter_local_notifications` on the `agrismart_alerts`
channel, subscribes to the `weather_alerts` and `crop_advisories` topics,
saves the device token to the `device_tokens` table, refreshes it
automatically, and deletes it on sign-out. Tapping an alert opens the Alerts
screen.

### Server setup

In Firebase console → Project settings → Service accounts → *Generate new
private key*, then save that JSON as the backend secret
`FCM_SERVICE_ACCOUNT_JSON`.

The backend then exposes:

```
POST /api/public/push/send      Authorization: Bearer <supabase token>
{ "title": "Heavy rain warning", "body": "...", "kind": "weather" }
-> { "sent": 1, "failed": 0, "devices": 1 }
```

It pushes to all of that farmer's registered devices (FCM HTTP v1), prunes
dead tokens, and stores the alert in the in-app Alerts list. The Alerts
screen has a bell icon that fires a test push end to end.
