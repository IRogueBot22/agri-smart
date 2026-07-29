import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/shell_screen.dart';
import 'screens/notifications_screen.dart';
import 'services/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (AppConfig.isConfigured) {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  }

  if (AppConfig.enablePush) {
    try {
      await Firebase.initializeApp();
      await PushService.init(
        onOpened: (_) => navigatorKey.currentState?.push(
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        ),
      );
    } catch (e) {
      debugPrint('[push] disabled: $e');
    }
  }

  runApp(const AgriSmartApp());
}

final navigatorKey = GlobalKey<NavigatorState>();

class AgriSmartApp extends StatefulWidget {
  const AgriSmartApp({super.key});

  @override
  State<AgriSmartApp> createState() => _AgriSmartAppState();
}

class _AgriSmartAppState extends State<AgriSmartApp> {
  ThemeMode _mode = ThemeMode.system;

  void setThemeMode(ThemeMode mode) => setState(() => _mode = mode);

  @override
  Widget build(BuildContext context) {
    return ThemeModeScope(
      mode: _mode,
      setMode: setThemeMode,
      child: MaterialApp(
        title: 'AgriSmart AI',
        navigatorKey: navigatorKey,
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: _mode,
        home: const SplashScreen(),
        routes: {
          '/onboarding': (_) => const OnboardingScreen(),
          '/auth': (_) => const AuthScreen(),
          '/home': (_) => const ShellScreen(),
        },
      ),
    );
  }
}

class ThemeModeScope extends InheritedWidget {
  const ThemeModeScope({
    super.key,
    required this.mode,
    required this.setMode,
    required super.child,
  });

  final ThemeMode mode;
  final void Function(ThemeMode) setMode;

  static ThemeModeScope of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ThemeModeScope>()!;

  @override
  bool updateShouldNotify(ThemeModeScope old) => old.mode != mode;
}
