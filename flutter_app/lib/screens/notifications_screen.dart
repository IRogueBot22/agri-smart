import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/db_service.dart';
import '../services/push_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<Map<String, dynamic>>> _future = DbService.notifications();

  Future<void> _test() async {
    try {
      await PushService.registerToken();
      final r = await PushService.sendAlert(
        title: 'AgriSmart test alert',
        body: 'Push notifications are working on this device.',
        kind: 'info',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sent to ${r['sent']} device(s)')));
      setState(() => _future = DbService.notifications());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', ''))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          IconButton(
            tooltip: 'Send test push',
            onPressed: _test,
            icon: const Icon(Icons.notifications_active_outlined),
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
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
