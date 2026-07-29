import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class GeoService {
  static const _kLastLat = 'last_lat';
  static const _kLastLng = 'last_lng';

  static Future<Position?> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied ||
        p == LocationPermission.deniedForever) {
      return null;
    }
    final pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    await cacheLast(pos);
    return pos;
  }

  /// Asks for the "Allow all the time" / "Always" permission needed to keep
  /// receiving fixes while the farmer is in another app or the screen is off.
  /// Android requires foreground permission to be granted first.
  static Future<bool> requestAlwaysPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied ||
        p == LocationPermission.deniedForever) {
      return false;
    }
    if (p == LocationPermission.whileInUse) {
      // Second prompt: Android 10+ / iOS upgrade to background access.
      p = await Geolocator.requestPermission();
    }
    return p == LocationPermission.always;
  }

  static Future<bool> hasAlwaysPermission() async =>
      await Geolocator.checkPermission() == LocationPermission.always;

  /// Foreground-only position stream (stops when the app is backgrounded).
  static Stream<Position> watch() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 5,
        ),
      );

  /// Position stream that keeps running while the app is in the background.
  ///
  /// Android: runs inside a foreground service with a persistent notification
  /// (required by the OS). iOS: enables background location updates, which
  /// needs the "location" UIBackgroundModes entry in Info.plist.
  static Stream<Position> watchBackground() {
    late final LocationSettings settings;
    if (Platform.isAndroid) {
      settings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'AgriSmart is tracking your field walk',
          notificationText:
              'Your position keeps updating so the map stays centred.',
          notificationChannelName: 'Field tracking',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    } else if (Platform.isIOS) {
      settings = AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
        activityType: ActivityType.otherNavigation,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    } else {
      settings = const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      );
    }
    return Geolocator.getPositionStream(locationSettings: settings);
  }

  /// Remembers the newest fix so the map opens centred where the farmer was,
  /// even if the app was killed while backgrounded.
  static Future<void> cacheLast(Position p) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_kLastLat, p.latitude);
    await prefs.setDouble(_kLastLng, p.longitude);
  }

  static Future<LatLng?> lastKnown() async {
    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_kLastLat);
    final lng = prefs.getDouble(_kLastLng);
    if (lat == null || lng == null) return null;
    return LatLng(lat, lng);
  }


  static const _earthRadius = 6378137.0;

  /// Spherical polygon area in square metres (same maths as Turf.js `area`).
  static double areaSqMeters(List<LatLng> pts) {
    if (pts.length < 3) return 0;
    double total = 0;
    for (var i = 0; i < pts.length; i++) {
      final p1 = pts[i];
      final p2 = pts[(i + 1) % pts.length];
      total += _rad(p2.longitude - p1.longitude) *
          (2 + math.sin(_rad(p1.latitude)) + math.sin(_rad(p2.latitude)));
    }
    return (total * _earthRadius * _earthRadius / 2).abs();
  }

  static double areaAcres(List<LatLng> pts) => areaSqMeters(pts) / 4046.8564224;

  static LatLng centroid(List<LatLng> pts) {
    final lat = pts.map((p) => p.latitude).reduce((a, b) => a + b) / pts.length;
    final lng = pts.map((p) => p.longitude).reduce((a, b) => a + b) / pts.length;
    return LatLng(lat, lng);
  }

  /// Square boundary of [acres] centred on [center] — used for
  /// "create a field at my current GPS position".
  static List<LatLng> squareAround(LatLng center, double acres) {
    final side = math.sqrt(acres * 4046.8564224); // metres
    final half = side / 2;
    final dLat = (half / _earthRadius) * 180 / math.pi;
    final dLng = dLat / math.cos(_rad(center.latitude));
    return [
      LatLng(center.latitude + dLat, center.longitude - dLng),
      LatLng(center.latitude + dLat, center.longitude + dLng),
      LatLng(center.latitude - dLat, center.longitude + dLng),
      LatLng(center.latitude - dLat, center.longitude - dLng),
    ];
  }

  /// Index at which to insert a new vertex for a tap near an edge.
  static int nearestEdgeIndex(List<LatLng> pts, LatLng tap) {
    var best = 0;
    var bestDist = double.infinity;
    for (var i = 0; i < pts.length; i++) {
      final a = pts[i];
      final b = pts[(i + 1) % pts.length];
      final d = _pointSegmentDistance(tap, a, b);
      if (d < bestDist) {
        bestDist = d;
        best = i + 1;
      }
    }
    return best;
  }

  static double _pointSegmentDistance(LatLng p, LatLng a, LatLng b) {
    final px = p.longitude, py = p.latitude;
    final ax = a.longitude, ay = a.latitude;
    final bx = b.longitude, by = b.latitude;
    final dx = bx - ax, dy = by - ay;
    if (dx == 0 && dy == 0) return _hyp(px - ax, py - ay);
    var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = t.clamp(0.0, 1.0);
    return _hyp(px - (ax + t * dx), py - (ay + t * dy));
  }

  static double _hyp(double a, double b) => math.sqrt(a * a + b * b);
  static double _rad(double deg) => deg * math.pi / 180;
}
