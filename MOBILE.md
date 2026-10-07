# AgriSmart AI — Native Android / iOS Build Guide (Capacitor)

This guide turns the existing AgriSmart AI web app into installable native
apps (`.apk` / `.aab` for Android, `.ipa` for iOS) using Capacitor.

---

## 0. Prerequisites

| Target  | You need |
| ------- | -------- |
| Both    | Node.js 20+, npm or bun, Git |
| Android | Android Studio (latest), JDK 17, Android SDK 34+ |
| iOS     | macOS, Xcode 15+, CocoaPods (`sudo gem install cocoapods`), an Apple Developer account for device/App Store builds |

---

## 1. Setup Local Environment

```bash
git clone https://github.com/IRogueBot22/agri-smart.git
cd agri-smart
npm install
```

Create a `.env` file with your configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `AI_GATEWAY_API_KEY` (or `OPENAI_API_KEY`)

---

## 2. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/geolocation @capacitor/push-notifications \
            @capacitor/network @capacitor/status-bar @capacitor/splash-screen \
            @capacitor/preferences @capacitor/app
npx cap init "AgriSmart AI" "com.agrismart.ai" --web-dir=dist
```

---

## 3. `capacitor.config.ts`

Create this at the project root:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrismart.ai',
  appName: 'AgriSmart AI',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#2E7D32',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: { contentInset: 'always' },
};

export default config;
```

---

## 4. Add Native Platforms

```bash
npm run build
npx cap add android
npx cap add ios        # macOS only
npx cap sync
```

---

## 5. Permissions

### Android — `android/app/src/main/AndroidManifest.xml`

Inside `<manifest>`, above `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>Used to photograph crop leaves for disease detection.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to select leaf photos for disease detection.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to map your fields and give live weather advisories.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Used to send severe weather alerts for your farm location.</string>
```

---

## 6. Build and Run

### Android

```bash
npx cap sync android
npx cap open android      # opens Android Studio
```

- Run on connected device with ▶.
- Debug APK: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
- Release AAB: **Build → Generate Signed Bundle / APK → Android App Bundle**

CLI alternative:
```bash
cd android && ./gradlew assembleDebug     # APK
cd android && ./gradlew bundleRelease     # AAB
```

### iOS (macOS only)

```bash
npx cap sync ios
npx cap open ios          # opens Xcode
```
