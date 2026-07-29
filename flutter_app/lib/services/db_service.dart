import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Thin wrapper over the shared backend (same Postgres/Auth/Storage as the web app).
class DbService {
  static SupabaseClient get client => Supabase.instance.client;
  static User? get user => client.auth.currentUser;
  static String get uid => client.auth.currentUser!.id;

  // ---------- Auth ----------
  static Future<void> signIn(String email, String password) =>
      client.auth.signInWithPassword(email: email, password: password);

  static Future<void> signUp(String email, String password, String fullName) =>
      client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );

  static Future<void> signInWithGoogle() => client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'app.lovable.agrismart://login-callback',
      );

  static Future<void> signOut() => client.auth.signOut();

  // ---------- Profile ----------
  static Future<Map<String, dynamic>?> profile() async =>
      await client.from('profiles').select().eq('id', uid).maybeSingle();

  static Future<void> updateProfile(Map<String, dynamic> patch) async =>
      await client.from('profiles').update(patch).eq('id', uid);

  // ---------- Fields ----------
  static Future<List<Map<String, dynamic>>> fields() async {
    final rows = await client
        .from('fields')
        .select()
        .eq('user_id', uid)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(rows);
  }

  static Future<Map<String, dynamic>> createField({
    required String name,
    required double areaAcres,
    required double centroidLat,
    required double centroidLng,
    required List<List<double>> polygon,
    String? crop,
    String? soilType,
    String? waterSource,
  }) async {
    final row = await client
        .from('fields')
        .insert({
          'user_id': uid,
          'name': name,
          'area_acres': areaAcres,
          'centroid_lat': centroidLat,
          'centroid_lng': centroidLng,
          'polygon': polygon,
          'crop': crop,
          'soil_type': soilType,
          'water_source': waterSource,
        })
        .select()
        .single();
    return row;
  }

  static Future<void> deleteField(String id) async =>
      await client.from('fields').delete().eq('id', id);

  // ---------- Market / schemes ----------
  static Future<List<Map<String, dynamic>>> marketPrices() async =>
      List<Map<String, dynamic>>.from(
          await client.from('market_prices').select().order('crop'));

  static Future<List<Map<String, dynamic>>> schemes() async =>
      List<Map<String, dynamic>>.from(
          await client.from('government_schemes').select().order('title'));

  // ---------- Notifications ----------
  static Future<List<Map<String, dynamic>>> notifications() async =>
      List<Map<String, dynamic>>.from(await client
          .from('notifications')
          .select()
          .eq('user_id', uid)
          .order('created_at', ascending: false));

  static Future<void> addNotification(
          String kind, String title, String body) async =>
      await client.from('notifications').insert({
        'user_id': uid,
        'kind': kind,
        'title': title,
        'body': body,
      });

  // ---------- Disease scans ----------
  static Future<String> uploadLeafScan(String fileName, Uint8List bytes) async {
    final path = '$uid/${DateTime.now().millisecondsSinceEpoch}_$fileName';
    await client.storage.from('leaf-scans').uploadBinary(path, bytes);
    return path;
  }

  static Future<String> signedLeafUrl(String path) =>
      client.storage.from('leaf-scans').createSignedUrl(path, 60 * 60);

  static Future<void> saveScan({
    required String imageUrl,
    String? disease,
    double? confidence,
    String? recommendation,
    String? fieldId,
  }) async =>
      await client.from('disease_scans').insert({
        'user_id': uid,
        'image_url': imageUrl,
        'disease': disease,
        'confidence': confidence,
        'recommendation': recommendation,
        'field_id': fieldId,
      });

  static Future<List<Map<String, dynamic>>> scans() async =>
      List<Map<String, dynamic>>.from(await client
          .from('disease_scans')
          .select()
          .eq('user_id', uid)
          .order('created_at', ascending: false));
}
