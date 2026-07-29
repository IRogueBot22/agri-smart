import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../services/db_service.dart';
import '../services/geo_service.dart';
import '../theme.dart';

/// Google Maps polygon drawing with add / edit / delete vertices,
/// tap-an-edge insertion, undo / redo, and live acre calculation.
class FieldDrawScreen extends StatefulWidget {
  const FieldDrawScreen({super.key});

  @override
  State<FieldDrawScreen> createState() => _FieldDrawScreenState();
}

enum DrawMode { add, edit }

class _FieldDrawScreenState extends State<FieldDrawScreen> {
  GoogleMapController? _map;
  List<LatLng> _points = [];
  final List<List<LatLng>> _past = [];
  final List<List<LatLng>> _future = [];
  DrawMode _mode = DrawMode.add;
  LatLng _initial = const LatLng(17.385, 78.4867);
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    GeoService.current().then((p) {
      if (p != null && mounted) {
        setState(() => _initial = LatLng(p.latitude, p.longitude));
        _map?.animateCamera(CameraUpdate.newLatLngZoom(_initial, 17));
      }
    });
  }

  void _commit(List<LatLng> next) {
    setState(() {
      _past.add(List<LatLng>.from(_points));
      _future.clear();
      _points = next;
    });
  }

  void _undo() {
    if (_past.isEmpty) return;
    setState(() {
      _future.add(List<LatLng>.from(_points));
      _points = _past.removeLast();
    });
  }

  void _redo() {
    if (_future.isEmpty) return;
    setState(() {
      _past.add(List<LatLng>.from(_points));
      _points = _future.removeLast();
    });
  }

  void _onMapTap(LatLng pos) {
    if (_mode == DrawMode.add) {
      _commit([..._points, pos]);
    } else if (_points.length >= 3) {
      // Edit mode: tapping near an edge inserts a new vertex there.
      final index = GeoService.nearestEdgeIndex(_points, pos);
      final next = List<LatLng>.from(_points)..insert(index, pos);
      _commit(next);
    }
  }

  void _dragVertex(int i, LatLng pos) {
    setState(() => _points[i] = pos);
  }

  void _endDrag(int i, LatLng pos) {
    final before = List<LatLng>.from(_points)..[i] = _points[i];
    _past.add(before);
    _future.clear();
    setState(() => _points[i] = pos);
  }

  void _deleteVertex(int i) {
    final next = List<LatLng>.from(_points)..removeAt(i);
    _commit(next);
  }

  double get _acres =>
      _points.length >= 3 ? GeoService.areaAcres(_points) : 0;

  Future<void> _save() async {
    if (_points.length < 3) return;
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => const _FieldDetailsDialog(),
    );
    if (result == null) return;

    setState(() => _saving = true);
    try {
      final c = GeoService.centroid(_points);
      await DbService.createField(
        name: result['name']!,
        areaAcres: double.parse(_acres.toStringAsFixed(4)),
        centroidLat: c.latitude,
        centroidLng: c.longitude,
        polygon: _points.map((p) => [p.longitude, p.latitude]).toList(),
        crop: result['crop'],
        soilType: result['soil'],
        waterSource: result['water'],
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Save failed: $e')));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Draw field'),
        actions: [
          IconButton(
              onPressed: _past.isEmpty ? null : _undo,
              icon: const Icon(Icons.undo)),
          IconButton(
              onPressed: _future.isEmpty ? null : _redo,
              icon: const Icon(Icons.redo)),
          IconButton(
              onPressed: _points.isEmpty ? null : () => _commit([]),
              icon: const Icon(Icons.clear)),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            mapType: MapType.hybrid,
            initialCameraPosition:
                CameraPosition(target: _initial, zoom: 16),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            onMapCreated: (c) => _map = c,
            onTap: _onMapTap,
            polygons: _points.length >= 3
                ? {
                    Polygon(
                      polygonId: const PolygonId('field'),
                      points: _points,
                      strokeWidth: 3,
                      strokeColor: kPrimary,
                      fillColor: kPrimary.withOpacity(.25),
                    )
                  }
                : {},
            polylines: _points.length == 2
                ? {
                    Polyline(
                      polylineId: const PolylineId('edge'),
                      points: _points,
                      color: kPrimary,
                      width: 3,
                    )
                  }
                : {},
            markers: {
              for (var i = 0; i < _points.length; i++)
                Marker(
                  markerId: MarkerId('v$i'),
                  position: _points[i],
                  draggable: _mode == DrawMode.edit,
                  onDrag: (p) => _dragVertex(i, p),
                  onDragEnd: (p) => _endDrag(i, p),
                  onTap: _mode == DrawMode.edit ? () => _deleteVertex(i) : null,
                  infoWindow: InfoWindow(title: 'Corner ${i + 1}'),
                ),
            },
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SegmentedButton<DrawMode>(
                      segments: const [
                        ButtonSegment(
                            value: DrawMode.add,
                            icon: Icon(Icons.add),
                            label: Text('Add')),
                        ButtonSegment(
                            value: DrawMode.edit,
                            icon: Icon(Icons.edit),
                            label: Text('Edit / Delete')),
                      ],
                      selected: {_mode},
                      onSelectionChanged: (s) =>
                          setState(() => _mode = s.first),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _mode == DrawMode.add
                          ? 'Tap the map to add corners (${_points.length}).'
                          : 'Drag a corner to reshape, tap it to delete, tap an edge to insert.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Text('Area: ${_acres.toStringAsFixed(3)} acres',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed:
                          _points.length >= 3 && !_saving ? _save : null,
                      child: _saving
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Save field'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldDetailsDialog extends StatefulWidget {
  const _FieldDetailsDialog();

  @override
  State<_FieldDetailsDialog> createState() => _FieldDetailsDialogState();
}

class _FieldDetailsDialogState extends State<_FieldDetailsDialog> {
  final _name = TextEditingController();
  final _crop = TextEditingController();
  final _soil = TextEditingController();
  final _water = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Field details'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Field name')),
            const SizedBox(height: 8),
            TextField(
                controller: _crop,
                decoration: const InputDecoration(labelText: 'Current crop')),
            const SizedBox(height: 8),
            TextField(
                controller: _soil,
                decoration: const InputDecoration(labelText: 'Soil type')),
            const SizedBox(height: 8),
            TextField(
                controller: _water,
                decoration: const InputDecoration(labelText: 'Water source')),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'name': _name.text.trim().isEmpty ? 'My field' : _name.text.trim(),
            'crop': _crop.text.trim(),
            'soil': _soil.text.trim(),
            'water': _water.text.trim(),
          }),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
