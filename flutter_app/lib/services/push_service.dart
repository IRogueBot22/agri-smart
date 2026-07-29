import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';

import 'db_service.dart';

/// Background isolate handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[push] background: ${message.messageId}');
}

/// Firebase Cloud Messaging: weather + recommendation alerts on Android & iOS.
class PushService {
  static final _local = FlutterLocalNotificationsPlugin();
  static const _channel = AndroidNotificationChannel(
    'agrismart_alerts',
    'AgriSmart alerts',
    description: 'Severe weather warnings and crop advisories',
    importance: Importance.high,
  );

  static bool _ready = false;

  /// Call once at app start (after Firebase.initializeApp()).
  static Future<void> init({
    void Function(RemoteMessage message)? onOpened,
  }) async {
    if (_ready) return;
    _ready = true;

    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

    // Local notification plugin (renders FCM payloads in the foreground).
    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[push] permission: ${settings.authorizationStatus}');
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // Broadcast topics — the backend can fan out alerts without a token list.
    await messaging.subscribeToTopic('weather_alerts');
    await messaging.subscribeToTopic('crop_advisories');

    FirebaseMessaging.onMessage.listen(_showLocal);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => onOpened?.call(m));
    final initial = await messaging.getInitialMessage();
    if (initial != null) onOpened?.call(initial);

    await registerToken();
    messaging.onTokenRefresh.listen((t) => _saveToken(t));
  }

  /// Registers this device's FCM token against the signed-in farmer.
  static Future<String?> registerToken() async {
    try {
      if (Platform.isIOS) {
        // APNs token must exist before the FCM token on iOS.
        await FirebaseMessaging.instance.getAPNSToken();
      }
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _saveToken(token);
      return token;
    } catch (e) {
      debugPrint('[push] token error: $e');
      return null;
    }
  }

  static Future<void> _saveToken(String token) async {
    if (DbService.user == null) return;
    try {
      await DbService.saveDeviceToken(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    } catch (e) {
      debugPrint('[push] save token failed: $e');
    }
  }

  /// Removes this device on sign-out so alerts stop following the phone.
  static Future<void> unregister() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await DbService.deleteDeviceToken(token);
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('[push] unregister failed: $e');
    }
  }

  static Future<void> _showLocal(RemoteMessage m) async {
    final n = m.notification;
    final title = n?.title ?? m.data['title'] ?? 'AgriSmart AI';
    final body = n?.body ?? m.data['body'] ?? '';
    await _local.show(
      m.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          styleInformation: BigTextStyleInformation(body),
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: m.data['kind']?.toString(),
    );
  }

  /// Asks the backend to push an alert to this farmer's devices
  /// (also stored in the in-app alerts list).
  static Future<Map<String, dynamic>> sendAlert({
    required String title,
    required String body,
    String kind = 'info',
  }) async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    final res = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/api/public/push/send'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'title': title, 'body': body, 'kind': kind}),
    );
    final decoded = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(decoded['error']?.toString() ?? 'Push failed');
    }
    return decoded;
  }
}
