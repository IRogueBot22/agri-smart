import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Native camera + gallery capture for crop / leaf photos.
class MediaService {
  static final _picker = ImagePicker();

  static Future<File?> capture({
    required ImageSource source,
    int quality = 85,
    double maxWidth = 1600,
  }) async {
    try {
      final x = await _picker.pickImage(
        source: source,
        imageQuality: quality,
        maxWidth: maxWidth,
        preferredCameraDevice: CameraDevice.rear,
      );
      return x == null ? null : File(x.path);
    } on Exception catch (e) {
      throw Exception(_friendly(e));
    }
  }

  /// Bottom sheet letting the farmer choose camera or gallery.
  static Future<File?> pickWithSheet(BuildContext context) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Take a photo'),
              subtitle: const Text('Use the phone camera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              subtitle: const Text('Pick an existing crop photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null) return null;
    return capture(source: source);
  }

  static String _friendly(Object e) {
    final s = e.toString();
    if (s.contains('camera_access_denied')) {
      return 'Camera permission denied. Enable camera access for AgriSmart in system settings.';
    }
    if (s.contains('photo_access_denied')) {
      return 'Photo library permission denied. Enable photo access in system settings.';
    }
    return 'Could not open the image picker: $s';
  }
}
