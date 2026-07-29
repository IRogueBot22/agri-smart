import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/db_service.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: DbService.notifications(),
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snap.data!;
          if (rows.isEmpty) {
            return const Center(child: Text('No alerts yet'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = rows[i];
              return Card(
                child: ListTile(
                  leading: Icon(n['kind'] == 'weather'
                      ? Icons.thunderstorm_outlined
                      : Icons.info_outline),
                  title: Text(n['title'] ?? ''),
                  subtitle: Text(n['body'] ?? ''),
                  trailing: Text(
                    DateFormat('d MMM')
                        .format(DateTime.parse(n['created_at'] as String)),
                    style: const TextStyle(fontSize: 12),
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
