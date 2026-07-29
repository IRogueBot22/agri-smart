import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';

/// AI features call the deployed web app's server functions.
/// The AI credentials stay server-side and never ship inside the APK/IPA.
class AiService {
  static Future<Map<String, dynamic>> _post(
      String fnPath, Map<String, dynamic> body) async {
    final token =
        Supabase.instance.client.auth.currentSession?.accessToken;

    final res = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}$fnPath'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 60));

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('AI request failed [${res.statusCode}]: ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    return decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{'result': decoded};
  }

  /// kind: crop | fertilizer | irrigation | yield
  static Future<Map<String, dynamic>> advise({
    required String kind,
    required Map<String, dynamic> field,
    Map<String, dynamic>? weather,
  }) =>
      _post('/api/public/ai/advise', {
        'kind': kind,
        'field': field,
        'weather': weather,
      });

  /// Vision diagnosis for a leaf photo already uploaded to storage.
  static Future<Map<String, dynamic>> detectDisease({
    required String imageUrl,
    String? crop,
  }) =>
      _post('/api/public/ai/disease', {'imageUrl': imageUrl, 'crop': crop});

  static Future<String> chat(String message,
      {List<Map<String, String>> history = const []}) async {
    final r = await _post('/api/public/ai/chat', {
      'message': message,
      'history': history,
    });
    return (r['reply'] ?? r['result'] ?? '').toString();
  }
}
