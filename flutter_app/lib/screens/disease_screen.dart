import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/ai_service.dart';
import '../services/media_service.dart';
import '../theme.dart';

const _maxPhotos = 5;

class DiseaseScreen extends StatefulWidget {
  const DiseaseScreen({super.key});

  @override
  State<DiseaseScreen> createState() => _DiseaseScreenState();
}

class _DiseaseScreenState extends State<DiseaseScreen> {
  final _cropCtrl = TextEditingController();
  final List<File> _images = [];
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

  void _add(List<File> files) {
    if (files.isEmpty) return;
    final room = _maxPhotos - _images.length;
    setState(() {
      _images.addAll(files.take(room));
      _result = null;
      _error = room < files.length
          ? 'Only $_maxPhotos photos can be scanned at once.'
          : null;
    });
  }

  Future<void> _pick(ImageSource source) async {
    try {
      if (source == ImageSource.gallery) {
        _add(await MediaService.captureMultiple(limit: _maxPhotos - _images.length));
      } else {
        final f = await MediaService.capture(source: source);
        if (f != null) _add([f]);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _analyze() async {
    if (_images.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _progress = 0;
      _stage = 'Uploading ${_images.length} photo(s)…';
    });
    try {
      final res = await AiService.scanLeaves(
        images: _images,
        crop: _cropCtrl.text.trim().isEmpty ? null : _cropCtrl.text.trim(),
        onProgress: (p) {
          if (!mounted) return;
          setState(() {
            _progress = p;
            _stage = p < 0.35
                ? 'Uploading ${_images.length} photo(s)…'
                : p < 0.8
                    ? 'Running TensorFlow CNN on each photo…'
                    : 'Ranking results…';
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

  List<String> _strList(dynamic v) => v is List
      ? List<String>.from(v.map((e) => '$e'))
      : (v == null ? <String>[] : ['$v']);

  @override
  Widget build(BuildContext context) {
    final r = _result;
    final combined = (r?['combined'] as Map?)?.cast<String, dynamic>() ?? r;
    final ranked = (r?['ranked'] as List?)?.cast<Map>() ?? const [];
    final conf = (combined?['confidence'] ?? combined?['avgConfidence']) as num?;
    final recs = _strList(combined?['recommendation']);
    final chemicals = _strList(combined?['chemicals']);
    final failed = (r?['imagesFailed'] as num?)?.toInt() ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Disease Detection')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_images.isEmpty)
            AspectRatio(
              aspectRatio: 4 / 3,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                ),
                child: const Center(
                  child: Icon(Icons.local_florist_outlined,
                      size: 64, color: kPrimary),
                ),
              ),
            )
          else
            SizedBox(
              height: 120,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _images.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) => Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.file(_images[i],
                          width: 120, height: 120, fit: BoxFit.cover),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: IconButton.filledTonal(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                  _images.removeAt(i);
                                  _result = null;
                                }),
                      ),
                    ),
                    Positioned(
                      left: 6,
                      bottom: 6,
                      child: CircleAvatar(
                        radius: 11,
                        backgroundColor: kPrimary,
                        child: Text('${i + 1}',
                            style: const TextStyle(
                                fontSize: 11, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          Text(
            '${_images.length}/$_maxPhotos photos selected — more angles give a more reliable ranking.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy || _images.length >= _maxPhotos
                      ? null
                      : () => _pick(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Camera'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy || _images.length >= _maxPhotos
                      ? null
                      : () => _pick(ImageSource.gallery),
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
            onPressed: _images.isEmpty || _busy ? null : _analyze,
            child: _busy
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_images.length > 1
                    ? 'Analyze ${_images.length} leaves'
                    : 'Analyze leaf'),
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
          if (combined != null) ...[
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(combined['disease']?.toString() ?? 'Unknown',
                        style: Theme.of(context).textTheme.titleLarge),
                    if (combined['crop'] != null)
                      Text('Crop: ${combined['crop']}',
                          style: Theme.of(context).textTheme.bodySmall),
                    Text(
                      'Based on ${r?['imagesAnalyzed'] ?? 1} photo(s)'
                      '${combined['agreement'] != null ? ' • ${combined['agreement']}% agreement' : ''}'
                      '${failed > 0 ? ' • $failed failed' : ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 10),
                    if (conf != null) ...[
                      LinearProgressIndicator(
                          value: (conf > 1 ? conf / 100 : conf).clamp(0, 1)),
                      const SizedBox(height: 4),
                      Text(
                          'Confidence: ${(conf > 1 ? conf : conf * 100).toStringAsFixed(1)}%'
                          '${combined['source'] == 'cnn' ? '  •  TensorFlow CNN' : '  •  Vision AI'}'),
                      const SizedBox(height: 12),
                    ],
                    if (combined['severity'] != null)
                      Text('Severity: ${combined['severity']}'),
                    if (combined['description'] != null) ...[
                      const SizedBox(height: 8),
                      Text(combined['description'].toString()),
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
          if (ranked.length > 1) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ranked candidates',
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text('Across all uploaded photos',
                        style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 10),
                    ...ranked.asMap().entries.map((e) {
                      final m = e.value.cast<String, dynamic>();
                      final imgs = (m['imageIndexes'] as List?) ?? const [];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 13,
                              backgroundColor:
                                  e.key == 0 ? kPrimary : Colors.grey.shade400,
                              child: Text('${e.key + 1}',
                                  style: const TextStyle(
                                      fontSize: 12, color: Colors.white)),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${m['disease']}'),
                                  Text(
                                    '${m['votes']} photo(s) • avg ${m['avgConfidence']}% • score ${m['score']}'
                                    '${imgs.isEmpty ? '' : ' • #${imgs.map((i) => (i as num) + 1).join(', #')}'}',
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
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
