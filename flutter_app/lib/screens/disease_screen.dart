import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/ai_service.dart';
import '../services/media_service.dart';
import '../theme.dart';

class DiseaseScreen extends StatefulWidget {
  const DiseaseScreen({super.key});

  @override
  State<DiseaseScreen> createState() => _DiseaseScreenState();
}

class _DiseaseScreenState extends State<DiseaseScreen> {
  final _cropCtrl = TextEditingController();
  File? _image;
  bool _busy = false;
  double _progress = 0;
  String _stage = '';
  Map<String, dynamic>? _result;
  String? _error;

  @override
  void dispose() {
    _cropCtrl.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource? source) async {
    try {
      final file = source == null
          ? await MediaService.pickWithSheet(context)
          : await MediaService.capture(source: source);
      if (file == null || !mounted) return;
      setState(() {
        _image = file;
        _result = null;
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _analyze() async {
    if (_image == null) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _progress = 0;
      _stage = 'Uploading leaf photo…';
    });
    try {
      final res = await AiService.scanLeaf(
        image: _image!,
        crop: _cropCtrl.text.trim().isEmpty ? null : _cropCtrl.text.trim(),
        onProgress: (p) {
          if (!mounted) return;
          setState(() {
            _progress = p;
            _stage = p < 0.35
                ? 'Uploading leaf photo…'
                : p < 0.8
                    ? 'Running TensorFlow CNN model…'
                    : 'Preparing recommendations…';
          });
        },
      );
      if (mounted) setState(() => _result = res);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _result;
    final conf = (r?['confidence'] as num?)?.toDouble();
    final recs = (r?['recommendation'] is List)
        ? List<String>.from((r!['recommendation'] as List).map((e) => '$e'))
        : (r?['recommendation'] == null
            ? <String>[]
            : ['${r!['recommendation']}']);
    final chemicals = (r?['chemicals'] is List)
        ? List<String>.from((r!['chemicals'] as List).map((e) => '$e'))
        : <String>[];

    return Scaffold(
      appBar: AppBar(title: const Text('Disease Detection')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                image: _image == null
                    ? null
                    : DecorationImage(
                        image: FileImage(_image!), fit: BoxFit.cover),
              ),
              child: _image == null
                  ? const Center(
                      child: Icon(Icons.local_florist_outlined,
                          size: 64, color: kPrimary))
                  : null,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy ? null : () => _pick(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Camera'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Gallery'),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cropCtrl,
            enabled: !_busy,
            decoration: const InputDecoration(
              labelText: 'Crop (optional)',
              hintText: 'e.g. Tomato',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _image == null || _busy ? null : _analyze,
            child: _busy
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Analyze leaf'),
          ),
          if (_busy) ...[
            const SizedBox(height: 16),
            LinearProgressIndicator(value: _progress == 0 ? null : _progress),
            const SizedBox(height: 6),
            Text(_stage, style: Theme.of(context).textTheme.bodySmall),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(_error!,
                    style: TextStyle(
                        color:
                            Theme.of(context).colorScheme.onErrorContainer)),
              ),
            ),
          ],
          if (r != null) ...[
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r['disease']?.toString() ?? 'Unknown',
                        style: Theme.of(context).textTheme.titleLarge),
                    if (r['crop'] != null)
                      Text('Crop: ${r['crop']}',
                          style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 10),
                    if (conf != null) ...[
                      LinearProgressIndicator(
                          value: (conf > 1 ? conf / 100 : conf).clamp(0, 1)),
                      const SizedBox(height: 4),
                      Text(
                          'Confidence: ${(conf > 1 ? conf : conf * 100).toStringAsFixed(1)}%'
                          '${r['source'] == 'cnn' ? '  •  TensorFlow CNN' : '  •  Vision AI'}'),
                      const SizedBox(height: 12),
                    ],
                    if (r['severity'] != null)
                      Text('Severity: ${r['severity']}'),
                    if (r['description'] != null) ...[
                      const SizedBox(height: 8),
                      Text(r['description'].toString()),
                    ],
                    if (recs.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('Recommendations',
                          style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 6),
                      ...recs.map((t) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('•  '),
                                Expanded(child: Text(t)),
                              ],
                            ),
                          )),
                    ],
                    if (chemicals.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text('Suggested inputs',
                          style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: chemicals
                            .map((c) => Chip(label: Text(c)))
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
