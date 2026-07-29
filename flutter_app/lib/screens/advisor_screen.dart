import 'package:flutter/material.dart';

import '../services/ai_service.dart';
import '../services/db_service.dart';
import '../services/geo_service.dart';
import '../services/weather_service.dart';

class AdvisorScreen extends StatefulWidget {
  const AdvisorScreen({super.key});

  @override
  State<AdvisorScreen> createState() => _AdvisorScreenState();
}

class _AdvisorScreenState extends State<AdvisorScreen>
    with SingleTickerProviderStateMixin {
  static const _kinds = ['crop', 'fertilizer', 'irrigation', 'yield'];
  late final TabController _tabs = TabController(length: 4, vsync: this);

  List<Map<String, dynamic>> _fields = [];
  Map<String, dynamic>? _selected;
  final Map<String, String> _results = {};
  final Map<String, bool> _busy = {};

  @override
  void initState() {
    super.initState();
    DbService.fields().then((f) {
      if (mounted) {
        setState(() {
          _fields = f;
          _selected = f.isNotEmpty ? f.first : null;
        });
      }
    });
  }

  Future<void> _run(String kind) async {
    if (_selected == null) return;
    setState(() => _busy[kind] = true);
    try {
      Map<String, dynamic>? weather;
      try {
        final pos = await GeoService.current();
        final w = await WeatherService.fetch(
          pos?.latitude ?? (_selected!['centroid_lat'] as num).toDouble(),
          pos?.longitude ?? (_selected!['centroid_lng'] as num).toDouble(),
        );
        weather = w.raw;
      } catch (_) {}

      final res = await AiService.advise(
          kind: kind, field: _selected!, weather: weather);
      setState(() => _results[kind] =
          (res['text'] ?? res['recommendation'] ?? res.toString()).toString());
    } catch (e) {
      setState(() => _results[kind] = 'Could not get advice: $e');
    } finally {
      if (mounted) setState(() => _busy[kind] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Advisor'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Crop'),
            Tab(text: 'Fertilizer'),
            Tab(text: 'Irrigation'),
            Tab(text: 'Yield'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: DropdownButtonFormField<Map<String, dynamic>>(
              value: _selected,
              decoration: const InputDecoration(labelText: 'Field'),
              items: _fields
                  .map((f) => DropdownMenuItem(
                        value: f,
                        child: Text(
                            '${f['name']} · ${(f['area_acres'] as num).toStringAsFixed(2)} ac'),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selected = v),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: _kinds.map(_panel).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _panel(String kind) {
    final busy = _busy[kind] == true;
    final text = _results[kind];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        FilledButton.icon(
          onPressed: _selected == null || busy ? null : () => _run(kind),
          icon: busy
              ? const SizedBox(
                  height: 18, width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.auto_awesome),
          label: Text('Get $kind recommendation'),
        ),
        const SizedBox(height: 16),
        if (text != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SelectableText(text),
            ),
          )
        else if (_fields.isEmpty)
          const Text('Add a field first to get recommendations.'),
      ],
    );
  }
}
