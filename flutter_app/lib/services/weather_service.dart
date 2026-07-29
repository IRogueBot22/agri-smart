import 'dart:convert';

import 'package:http/http.dart' as http;

class WeatherResult {
  WeatherResult({required this.raw, required this.place, required this.advisory});
  final Map<String, dynamic> raw;
  final String? place;
  final List<String> advisory;

  Map<String, dynamic> get current =>
      Map<String, dynamic>.from(raw['current'] ?? {});
  Map<String, dynamic> get daily =>
      Map<String, dynamic>.from(raw['daily'] ?? {});
  Map<String, dynamic> get hourly =>
      Map<String, dynamic>.from(raw['hourly'] ?? {});
}

/// Live weather straight from Open-Meteo (no API key, works offline-first with cache).
class WeatherService {
  static Uri _weatherUrl(double lat, double lng) =>
      Uri.parse('https://api.open-meteo.com/v1/forecast'
          '?latitude=$lat&longitude=$lng'
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,'
          'precipitation,weather_code,wind_speed_10m,wind_direction_10m,'
          'surface_pressure,is_day'
          '&hourly=temperature_2m,precipitation_probability,weather_code'
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,'
          'precipitation_sum,precipitation_probability_max,wind_speed_10m_max,'
          'uv_index_max,sunrise,sunset'
          '&timezone=auto&forecast_days=7');

  static Uri _geoUrl(double lat, double lng) => Uri.parse(
      'https://api.open-meteo.com/v1/reverse?latitude=$lat&longitude=$lng&language=en');

  static Future<WeatherResult> fetch(double lat, double lng) async {
    final res = await http
        .get(_weatherUrl(lat, lng))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Weather service unavailable (${res.statusCode})');
    }
    final raw = jsonDecode(res.body) as Map<String, dynamic>;

    String? place;
    try {
      final g = await http
          .get(_geoUrl(lat, lng))
          .timeout(const Duration(seconds: 6));
      final results = (jsonDecode(g.body)['results'] as List?) ?? [];
      if (results.isNotEmpty) {
        final r = results.first as Map<String, dynamic>;
        place = [r['name'], r['admin1'], r['country_code']]
            .where((e) => e != null && '$e'.isNotEmpty)
            .join(', ');
      }
    } catch (_) {}

    return WeatherResult(raw: raw, place: place, advisory: buildAdvisory(raw));
  }

  /// Same rules as the web app's irrigation/severe-weather advisory engine.
  static List<String> buildAdvisory(Map<String, dynamic> w) {
    final out = <String>[];
    final cur = Map<String, dynamic>.from(w['current'] ?? {});
    final daily = Map<String, dynamic>.from(w['daily'] ?? {});

    final rainSum = (daily['precipitation_sum'] as List?) ?? [];
    final rain3 = rainSum
        .take(3)
        .fold<double>(0, (a, b) => a + ((b as num?)?.toDouble() ?? 0));
    final temp = (cur['temperature_2m'] as num?)?.toDouble() ?? 0;
    final wind = (cur['wind_speed_10m'] as num?)?.toDouble() ?? 0;
    final code = (cur['weather_code'] as num?)?.toInt() ?? 0;

    if (rain3 >= 25) {
      out.add('Heavy rain expected (${rain3.toStringAsFixed(0)} mm in 3 days) — '
          'skip irrigation and check field drainage.');
    } else if (rain3 < 2) {
      out.add('Little rain forecast — irrigate within the next 48 hours.');
    }
    if (temp >= 40) out.add('Extreme heat — irrigate early morning or evening only.');
    if (temp <= 5) out.add('Frost risk tonight — cover seedlings and irrigate lightly.');
    if (wind >= 40) {
      out.add('High wind (${wind.toStringAsFixed(0)} km/h) — postpone spraying.');
    }
    if (code >= 95) out.add('Thunderstorm warning — secure equipment and avoid open fields.');
    if (out.isEmpty) out.add('Conditions are normal. Continue your regular schedule.');
    return out;
  }

  static String describe(int code) {
    if (code == 0) return 'Clear sky';
    if (code <= 2) return 'Partly cloudy';
    if (code == 3) return 'Overcast';
    if (code <= 48) return 'Fog';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    return 'Thunderstorm';
  }
}
