# AgriSmart AI — Native Android / iOS Build Guide (Capacitor)

This guide turns the existing AgriSmart AI web app into installable native
apps (`.apk` / `.aab` for Android, `.ipa` for iOS) using Capacitor.

All steps run **outside the Lovable editor**, on your own machine.

---

## 0. Prerequisites

| Target  | You need |
| ------- | -------- |
| Both    | Node.js 20+, npm or bun, Git |
| Android | Android Studio (latest), JDK 17, Android SDK 34+ |
| iOS     | macOS, Xcode 15+, CocoaPods (`sudo gem install cocoapods`), an Apple Developer account for device/App Store builds |

---

## 1. Export the project

1. In Lovable: **GitHub → Connect / Export to GitHub**.
2. Clone it locally:

```bash
git clone https://github.com/<you>/agrismart-ai.git
cd agrismart-ai
npm install
```

3. Create a `.env` file with the same values shown in the Lovable project
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).

---

## 2. Decide how the native shell loads the app

Capacitor can either bundle static files or point the WebView at your live URL.
This project is a **server-rendered TanStack Start app** with server functions
(AI advisor, weather, disease detection), so the correct choice is:

> **Remote mode** — the native shell loads `https://farmflow-ai-advisor.lovable.app`

That keeps every server function, AI gateway call, and auth flow working
exactly as it does today. You still get native camera, GPS, push, and an app
icon, because the plugins run in the native layer, not in the page.

(Pure static/offline bundling would require rewriting all server functions into
client-side calls — not recommended.)

---

## 3. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/geolocation @capacitor/push-notifications \
            @capacitor/network @capacitor/status-bar @capacitor/splash-screen \
            @capacitor/preferences @capacitor/app
npx cap init "AgriSmart AI" "app.lovable.agrismart" --web-dir=dist
```

---

## 4. `capacitor.config.ts`

Create this at the project root:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.agrismart',
  appName: 'AgriSmart AI',
  webDir: 'dist',
  server: {
    // Remote mode: the shell loads the deployed app
    url: 'https://farmflow-ai-advisor.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
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

For a fully offline/static build instead, delete the whole `server` block and
run `npm run build` so `dist/` is bundled into the app.

---

## 5. Add the native platforms

```bash
npm run build          # creates dist/ (needed even in remote mode)
npx cap add android
npx cap add ios        # macOS only
npx cap sync
```

---

## 6. Permissions

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

## 7. Wire native camera + GPS (optional but recommended)

The web app already uses `<input type="file" capture>` and
`navigator.geolocation`, which **work inside the Capacitor WebView**. Use the
native plugins only if you want better UX:

```ts
// native camera
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const photo = await Camera.getPhoto({
  quality: 80,
  resultType: CameraResultType.Base64,
  source: CameraSource.Prompt, // camera or gallery
});
// photo.base64String -> upload to the leaf-scans bucket
```

```ts
// native GPS
import { Geolocation } from '@capacitor/geolocation';
const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
```

Guard them so the browser build still works:

```ts
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) { /* plugin path */ } else { /* web path */ }
```

---

## 8. Push notifications (severe weather alerts)

The current in-app alerts use the browser Notification API. For true background
push you need Firebase Cloud Messaging:

1. Create a Firebase project → add an Android app with id `app.lovable.agrismart`.
2. Download `google-services.json` → place in `android/app/`.
3. iOS: add an APNs key in the Apple Developer portal, upload it to Firebase,
   download `GoogleService-Info.plist` → drag into `ios/App/App/` in Xcode,
   and enable **Push Notifications** + **Background Modes → Remote notifications**
   capabilities.
4. Register on app start:

```ts
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.requestPermissions();
await PushNotifications.register();
PushNotifications.addListener('registration', (t) => {
  // POST t.value to your backend and store it against the user
});
```

5. Store the token server-side and send weather alerts from a scheduled job.

---

## 9. App icon and splash

```bash
npm install -D @capacitor/assets
mkdir -p assets
# assets/icon.png        1024x1024
# assets/splash.png      2732x2732 (green #2E7D32 background, logo centered)
npx capacitor-assets generate
```

The existing PWA icons in `public/` can be upscaled as source art.

---

## 10. Build and run

### Android

```bash
npx cap sync android
npx cap open android      # opens Android Studio
```

- Run on device: press ▶.
- Debug APK: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
  → `android/app/build/outputs/apk/debug/app-debug.apk`
- Release AAB for Play Store: **Build → Generate Signed Bundle / APK → Android App Bundle**,
  create a keystore, keep it safe (you need the same key for every future update).

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

- Select your Team under **Signing & Capabilities**.
- Run on a connected iPhone with ▶.
- For TestFlight/App Store: **Product → Archive → Distribute App**.

---

## 11. Updating the app later

- **Remote mode:** publish in Lovable — the native app picks up changes on next
  launch. No store resubmission needed for web changes.
- **Native changes** (plugins, permissions, icons): rebuild and resubmit.
- After any dependency or config change: `npm run build && npx cap sync`.

---

## 12. Auth note (Google sign-in)

In remote mode Google OAuth works because the WebView loads the real origin.
Make sure `https://farmflow-ai-advisor.lovable.app` stays in the allowed
redirect URLs. If you later switch to static bundling, you must add the
`capacitor://localhost` / `https://localhost` origins and use
`@capacitor/browser` for the OAuth round-trip.

---

## 13. Store submission checklist

- Privacy policy URL (required — you collect location and photos).
- Data-safety / App Privacy forms: Location, Photos, Account info.
- Android target SDK 34+, iOS deployment target 13+.
- Screenshots: phone 1080x1920 (Android), 6.7" and 5.5" (iOS).
- Short + full description, feature graphic 1024x500 (Play Store).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| White screen on launch | Wrong `webDir` or missing `npm run build`; check `npx cap sync` output |
| Network calls blocked on Android | Ensure `androidScheme: 'https'`, no `cleartext` HTTP endpoints |
| Camera returns nothing on iOS | Missing `NSCameraUsageDescription` in Info.plist |
| Location always denied | Request permission at runtime on Android 13+, and check app settings |
| Gradle build fails on JDK | Set Gradle JDK to 17 in Android Studio → Settings → Build Tools → Gradle |
