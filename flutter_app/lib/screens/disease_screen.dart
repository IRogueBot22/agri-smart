import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/ai_service.dart';
import '../services/db_service.dart';
import '../theme.dart';

class DiseaseScreen extends StatefulWidget {
  const DiseaseScreen({super.key});

  @override
  State<DiseaseScreen> createState() => _DiseaseScreenState();
}

class _DiseaseScreenState extends State<DiseaseScreen> {
  File? _image;
  bool _busy = false;
  Map<String, dynamic>? _result;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker()
        .pickImage(source: source, imageQuality: 85, maxWidth: 1600);
    if (picked == null) return;
    setState(() {
      _image = File(picked.path);
      _result = null;
      _error = null;
    });
  }

  Future<void> _analyze() async {
    if (_image == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes = await _image!.readAsBytes();
      final path = await DbService.uploadLeafScan(
          _image!.path.split('/').last, bytes);
      final signed = await DbService.signedLeafUrl(path);

      final res = await AiService.detectDisease(imageUrl: signed);

      await DbService.saveScan(
        imageUrl: path,
        disease: res['disease']?.toString(),
        confidence: (res['confidence'] as num?)?.toDouble(),
        recommendation: res['recommendation']?.toString(),
      );

      if (mounted) setState(() => _result = res);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conf = (_result?['confidence'] as num?)?.toDouble();
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
          FilledButton(
            onPressed: _image == null || _busy ? null : _analyze,
            child: _busy
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Analyze leaf'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          if (_result != null) ...[
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_result!['disease']?.toString() ?? 'Unknown',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    if (conf != null) ...[
                      LinearProgressIndicator(
                          value: conf > 1 ? conf / 100 : conf),
                      const SizedBox(height: 4),
                      Text(
                          'Confidence: ${(conf > 1 ? conf : conf * 100).toStringAsFixed(1)}%'),
                      const SizedBox(height: 12),
                    ],
                    if (_result!['severity'] != null)
                      Text('Severity: ${_result!['severity']}'),
                    const SizedBox(height: 8),
                    Text(_result!['recommendation']?.toString() ?? ''),
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
