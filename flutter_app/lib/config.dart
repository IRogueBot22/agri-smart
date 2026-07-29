/// Build-time configuration. Pass with --dart-define (see README).
class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Deployed web app base URL — hosts the AI server functions.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://farmflow-ai-advisor.lovable.app',
  );

  static const googleMapsApiKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');

  /// Set to false to run without Firebase (push notifications disabled).
  static const enablePush = bool.fromEnvironment('ENABLE_PUSH', defaultValue: true);

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
