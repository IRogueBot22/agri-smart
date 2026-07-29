import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/db_service.dart';
import '../services/geo_service.dart';
import '../services/weather_service.dart';
import '../theme.dart';
import 'disease_screen.dart';
import 'market_screen.dart';
import 'schemes_screen.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  WeatherResult? _weather;
  List<Map<String, dynamic>> _fields = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _restoreCache();
    _load();
  }

  Future<void> _restoreCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('cache_weather');
    if (raw != null && mounted) {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      setState(() => _weather = WeatherResult(
            raw: decoded,
            place: prefs.getString('cache_place'),
            advisory: WeatherService.buildAdvisory(decoded),
          ));
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final fields = await DbService.fields();
      final pos = await GeoService.current();
      final lat = pos?.latitude ??
          (fields.isNotEmpty
              ? (fields.first['centroid_lat'] as num).toDouble()
              : 17.385);
      final lng = pos?.longitude ??
          (fields.isNotEmpty
              ? (fields.first['centroid_lng'] as num).toDouble()
              : 78.4867);

      final w = await WeatherService.fetch(lat, lng);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cache_weather', jsonEncode(w.raw));
      if (w.place != null) await prefs.setString('cache_place', w.place!);

      if (!mounted) return;
      setState(() {
        _fields = fields;
        _weather = w;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Offline — showing cached data.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cur = _weather?.current;
    return Scaffold(
      appBar: AppBar(
        title: const Text('AgriSmart AI'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const NotificationsScreen())),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _weather == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!,
                          style: const TextStyle(color: Colors.orange)),
                    ),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const LinearGradient(
                        colors: [kPrimary, kPrimaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_weather?.place ?? 'Your farm',
                            style: const TextStyle(color: Colors.white70)),
                        const SizedBox(height: 8),
                        Text(
                          cur == null
                              ? '--'
                              : '${(cur['temperature_2m'] as num).round()}°C',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 44,
                              fontWeight: FontWeight.w700),
                        ),
                        Text(
                          cur == null
                              ? ''
                              : WeatherService.describe(
                                  (cur['weather_code'] as num).toInt()),
                          style: const TextStyle(color: Colors.white),
                        ),
                        const SizedBox(height: 12),
                        if (_weather != null)
                          Text(_weather!.advisory.first,
                              style: const TextStyle(color: Colors.white70)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Quick actions',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.6,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _action(Icons.camera_alt_outlined, 'Disease scan',
                          const DiseaseScreen()),
                      _action(Icons.trending_up, 'Market prices',
                          const MarketScreen()),
                      _action(Icons.account_balance_outlined, 'Schemes',
                          const SchemesScreen()),
                      _action(Icons.notifications_active_outlined, 'Alerts',
                          const NotificationsScreen()),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text('Your fields (${_fields.length})',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ..._fields.map((f) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: const Icon(Icons.grass, color: kPrimary),
                          title: Text(f['name'] ?? 'Field'),
                          subtitle: Text(
                              '${(f['area_acres'] as num).toStringAsFixed(2)} acres'
                              '${f['crop'] != null ? ' · ${f['crop']}' : ''}'),
                        ),
                      )),
                ],
              ),
      ),
    );
  }

  Widget _action(IconData icon, String label, Widget page) => Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => Navigator.push(
              context, MaterialPageRoute(builder: (_) => page)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: kPrimary),
                const SizedBox(height: 8),
                Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      );
}
