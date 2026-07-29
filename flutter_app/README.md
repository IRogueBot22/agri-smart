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
