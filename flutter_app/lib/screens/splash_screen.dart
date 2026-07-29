import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import '../theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    if (!AppConfig.isConfigured) {
      setState(() => _error =
          'Missing SUPABASE_URL / SUPABASE_ANON_KEY. Pass them with --dart-define (see README).');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getBool('onboarded') ?? false;
    final session = Supabase.instance.client.auth.currentSession;

    if (!mounted) return;
    if (!seen) {
      Navigator.pushReplacementNamed(context, '/onboarding');
    } else if (session == null) {
      Navigator.pushReplacementNamed(context, '/auth');
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kPrimary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.eco, size: 88, color: Colors.white),
            const SizedBox(height: 16),
            const Text('AgriSmart AI',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text('Smart Farmer Advisory System',
                style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 32),
            if (_error == null)
              const CircularProgressIndicator(color: Colors.white)
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white)),
              ),
          ],
        ),
      ),
    );
  }
}
