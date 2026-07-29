import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class GeoService {
  static Future<Position?> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied ||
        p == LocationPermission.deniedForever) {
      return null;
    }
    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  static Stream<Position> watch() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 5,
        ),
      );

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
