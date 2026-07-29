import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
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

  /// Full leaf-scan flow: uploads the photo to the backend, which stores it,
  /// runs the Python TensorFlow CNN and returns a structured diagnosis.
  static Future<Map<String, dynamic>> scanLeaf({
    required File image,
    String? crop,
    String? fieldId,
    void Function(double progress)? onProgress,
  }) async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token == null) {
      throw Exception('You must be signed in to scan a leaf.');
    }

    final ext = image.path.split('.').last.toLowerCase();
    final mime = switch (ext) {
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      'heic' => MediaType('image', 'heic'),
      _ => MediaType('image', 'jpeg'),
    };

    onProgress?.call(0.1);
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('${AppConfig.apiBaseUrl}/api/public/ai/disease-scan'),
    )
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['crop'] = crop ?? ''
      ..fields['fieldId'] = fieldId ?? ''
      ..files.add(await http.MultipartFile.fromPath(
        'file',
        image.path,
        contentType: mime,
      ));

    onProgress?.call(0.35);
    final streamed = await req.send().timeout(const Duration(seconds: 90));
    onProgress?.call(0.8);
    final res = await http.Response.fromStream(streamed);
    onProgress?.call(1);

    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Scan failed [${res.statusCode}]: ${res.body}');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(decoded['error']?.toString() ??
          'Scan failed [${res.statusCode}]');
    }
    return decoded;
  }

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
