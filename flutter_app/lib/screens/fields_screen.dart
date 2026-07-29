import 'package:flutter/material.dart';

import '../services/db_service.dart';
import '../theme.dart';
import 'field_draw_screen.dart';

class FieldsScreen extends StatefulWidget {
  const FieldsScreen({super.key});

  @override
  State<FieldsScreen> createState() => _FieldsScreenState();
}

class _FieldsScreenState extends State<FieldsScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = DbService.fields();
  }

  void _reload() => setState(() => _future = DbService.fields());

  Future<void> _openDraw({Map<String, dynamic>? field}) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => FieldDrawScreen(field: field)),
    );
    if (saved == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Fields'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_location_alt_outlined),
            onPressed: () => _openDraw(),
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final fields = snap.data!;
          if (fields.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.map_outlined, size: 64, color: kPrimary),
                  const SizedBox(height: 12),
                  const Text('No fields yet'),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => _openDraw(),
                    child: const Text('Draw your first field'),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: fields.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final f = fields[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.grass, color: kPrimary),
                  title: Text(f['name'] ?? 'Field'),
                  subtitle: Text(
                      '${(f['area_acres'] as num).toStringAsFixed(2)} acres · '
                      '${f['soil_type'] ?? 'soil n/a'} · ${f['water_source'] ?? 'water n/a'}'),
                  onTap: () => _openDraw(field: f),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Edit boundary',
                        icon: const Icon(Icons.edit_location_alt_outlined),
                        onPressed: () => _openDraw(field: f),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          await DbService.deleteField(f['id'] as String);
                          _reload();
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
