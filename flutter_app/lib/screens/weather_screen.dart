import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/geo_service.dart';
import '../services/weather_service.dart';
import '../theme.dart';

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key});

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  WeatherResult? _w;
  String? _error;
  bool _loading = true;
  Timer? _timer;
  double _lat = 17.385, _lng = 78.4867;

  @override
  void initState() {
    super.initState();
    _load();
    // Background auto-refresh every 5 minutes.
    _timer = Timer.periodic(const Duration(minutes: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final pos = await GeoService.current();
      if (pos != null) {
        _lat = pos.latitude;
        _lng = pos.longitude;
      }
      final w = await WeatherService.fetch(_lat, _lng);
      if (!mounted) return;
      setState(() {
        _w = w;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Live Weather')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Card(
                      color: Theme.of(context).colorScheme.errorContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(_error!),
                      ),
                    ),
                  if (_w != null) ..._content(_w!),
                ],
              ),
      ),
    );
  }

  List<Widget> _content(WeatherResult w) {
    final cur = w.current;
    final daily = w.daily;
    final hourly = w.hourly;
    final days = (daily['time'] as List?) ?? [];
    final hours = (hourly['time'] as List?) ?? [];

    return [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
              colors: [kPrimary, kPrimaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(w.place ?? 'Current location',
                style: const TextStyle(color: Colors.white70)),
            Text('${(cur['temperature_2m'] as num).round()}°C',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 48,
                    fontWeight: FontWeight.w700)),
            Text(
                '${WeatherService.describe((cur['weather_code'] as num).toInt())} · '
                'feels ${(cur['apparent_temperature'] as num).round()}°C',
                style: const TextStyle(color: Colors.white)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _chip('Humidity', '${cur['relative_humidity_2m']}%'),
                _chip('Wind', '${(cur['wind_speed_10m'] as num).round()} km/h'),
                _chip('Rain', '${cur['precipitation']} mm'),
                _chip('Pressure',
                    '${(cur['surface_pressure'] as num).round()} hPa'),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Farm advisory',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ...w.advisory.map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.circle, size: 8, color: kPrimary),
                        const SizedBox(width: 8),
                        Expanded(child: Text(a)),
                      ],
                    ),
                  )),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      const Text('Next 24 hours',
          style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      SizedBox(
        height: 100,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: hours.length > 24 ? 24 : hours.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final t = DateTime.parse(hours[i] as String);
            return Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(DateFormat('ha').format(t)),
                    const SizedBox(height: 6),
                    Text('${(hourly['temperature_2m'][i] as num).round()}°',
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w600)),
                    Text('${hourly['precipitation_probability'][i]}%',
                        style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 16),
      const Text('7-day forecast',
          style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      ...List.generate(days.length, (i) {
        final d = DateTime.parse(days[i] as String);
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(DateFormat('EEE, d MMM').format(d)),
            subtitle: Text(WeatherService.describe(
                (daily['weather_code'][i] as num).toInt())),
            trailing: Text(
              '${(daily['temperature_2m_max'][i] as num).round()}° / '
              '${(daily['temperature_2m_min'][i] as num).round()}°',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        );
      }),
    ];
  }

  Widget _chip(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
          Text(value,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      );
}
