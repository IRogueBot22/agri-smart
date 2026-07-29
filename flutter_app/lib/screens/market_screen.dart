import 'package:flutter/material.dart';

import '../services/db_service.dart';

class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  late Future<List<Map<String, dynamic>>> _future = DbService.marketPrices();
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Market Prices')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                  hintText: 'Search crop or market',
                  prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snap) {
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final rows = snap.data!
                    .where((r) =>
                        '${r['crop']} ${r['market']} ${r['state']}'
                            .toLowerCase()
                            .contains(_query))
                    .toList();
                return RefreshIndicator(
                  onRefresh: () async =>
                      setState(() => _future = DbService.marketPrices()),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      final price = (r['price_per_quintal'] as num).toDouble();
                      final prev = (r['prev_price'] as num?)?.toDouble();
                      final up = prev == null ? null : price >= prev;
                      final delta = prev == null || prev == 0
                          ? null
                          : ((price - prev) / prev * 100);
                      return Card(
                        child: ListTile(
                          title: Text(r['crop'] ?? ''),
                          subtitle: Text('${r['market']}, ${r['state']}'),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('₹${price.toStringAsFixed(0)}/qtl',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700)),
                              if (delta != null)
                                Text(
                                  '${up! ? '▲' : '▼'} ${delta.abs().toStringAsFixed(1)}%',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: up
                                          ? Colors.green
                                          : Colors.redAccent),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
