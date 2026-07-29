import 'package:flutter/material.dart';

import '../services/db_service.dart';

class SchemesScreen extends StatelessWidget {
  const SchemesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Government Schemes')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: DbService.schemes(),
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snap.data!;
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final s = rows[i];
              return Card(
                child: ExpansionTile(
                  shape: const Border(),
                  title: Text(s['title'] ?? ''),
                  subtitle: Text(s['category'] ?? ''),
                  childrenPadding:
                      const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  expandedCrossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s['description'] ?? ''),
                    const SizedBox(height: 12),
                    _row('Benefits', s['benefits']),
                    _row('Eligibility', s['eligibility']),
                    _row('Documents', s['documents']),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _row(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text('${value ?? '-'}'),
          ],
        ),
      );
}
