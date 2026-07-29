import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../services/db_service.dart';
import '../services/geo_service.dart';
import '../theme.dart';

/// Google Maps polygon drawing with GPS auto-centre, live location follow,
/// add / edit / delete vertices, tap-an-edge insertion, undo / redo,
/// live acre calculation, and create **or update** of a field.
class FieldDrawScreen extends StatefulWidget {
  const FieldDrawScreen({super.key, this.field});

  /// Existing field row to edit. When null the screen creates a new field.
  final Map<String, dynamic>? field;

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
  Position? _position;
  StreamSubscription<Position>? _watch;
  bool _follow = true;
  bool _locating = true;
  bool _saving = false;

  bool get _isEdit => widget.field != null;

  @override
  void initState() {
    super.initState();
    _loadExisting();
    _startGps();
  }

  @override
  void dispose() {
    _watch?.cancel();
    super.dispose();
  }

  void _loadExisting() {
    final f = widget.field;
    if (f == null) return;
    final raw = f['polygon'];
    if (raw is List) {
      _points = raw
          .whereType<List>()
          .map((c) => LatLng(
              (c[1] as num).toDouble(), (c[0] as num).toDouble()))
          .toList();
    }
    if (_points.isNotEmpty) {
      _initial = GeoService.centroid(_points);
      _follow = false;
      _mode = DrawMode.edit;
    }
  }

  Future<void> _startGps() async {
    final p = await GeoService.current();
    if (!mounted) return;
    setState(() {
      _locating = false;
      _position = p;
    });
    if (p == null) return;

    final here = LatLng(p.latitude, p.longitude);
    if (!_isEdit || _points.isEmpty) {
      _initial = here;
      _moveCamera(here, 18);
    }

    _watch = GeoService.watch().listen((pos) {
      if (!mounted) return;
      setState(() => _position = pos);
      if (_follow) _moveCamera(LatLng(pos.latitude, pos.longitude), null);
    });
  }

  void _moveCamera(LatLng target, double? zoom) {
    _map?.animateCamera(zoom == null
        ? CameraUpdate.newLatLng(target)
        : CameraUpdate.newLatLngZoom(target, zoom));
  }

  Future<void> _centerOnMe() async {
    final p = _position ?? await GeoService.current();
    if (p == null) {
      _toast('Location unavailable — enable GPS and grant permission.');
      return;
    }
    if (!mounted) return;
    setState(() {
      _position = p;
      _follow = true;
    });
    _moveCamera(LatLng(p.latitude, p.longitude), 18);
  }

  /// Drops a corner exactly at the current GPS reading — lets the farmer
  /// walk the boundary and tap once at each corner.
  Future<void> _addPointAtMe() async {
    final p = _position ?? await GeoService.current();
    if (p == null) {
      _toast('Location unavailable — enable GPS and grant permission.');
      return;
    }
    _commit([..._points, LatLng(p.latitude, p.longitude)]);
    _toast('Corner added at your GPS position '
        '(±${p.accuracy.toStringAsFixed(0)} m)');
  }

  /// Builds a square boundary of the given size centred on the current GPS fix.
  Future<void> _squareAroundMe(double acres) async {
    final p = _position ?? await GeoService.current();
    if (p == null) {
      _toast('Location unavailable — enable GPS and grant permission.');
      return;
    }
    final here = LatLng(p.latitude, p.longitude);
    _commit(GeoService.squareAround(here, acres));
    setState(() => _follow = false);
    _moveCamera(here, 17);
  }

  void _toast(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m)));
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
      final index = GeoService.nearestEdgeIndex(_points, pos);
      final next = List<LatLng>.from(_points)..insert(index, pos);
      _commit(next);
    }
  }

  void _dragVertex(int i, LatLng pos) => setState(() => _points[i] = pos);

  void _endDrag(int i, LatLng pos) {
    final before = List<LatLng>.from(_points);
    _past.add(before);
    _future.clear();
    setState(() => _points[i] = pos);
  }

  void _deleteVertex(int i) {
    final next = List<LatLng>.from(_points)..removeAt(i);
    _commit(next);
  }

  double get _acres => _points.length >= 3 ? GeoService.areaAcres(_points) : 0;

  Future<void> _save() async {
    if (_points.length < 3) return;
    final f = widget.field;
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _FieldDetailsDialog(
        name: f?['name']?.toString(),
        crop: f?['crop']?.toString(),
        soil: f?['soil_type']?.toString(),
        water: f?['water_source']?.toString(),
      ),
    );
    if (result == null) return;

    setState(() => _saving = true);
    try {
      final c = GeoService.centroid(_points);
      final polygon = _points.map((p) => [p.longitude, p.latitude]).toList();
      final area = double.parse(_acres.toStringAsFixed(4));

      if (_isEdit) {
        await DbService.updateField(
          id: f!['id'] as String,
          name: result['name'],
          areaAcres: area,
          centroidLat: c.latitude,
          centroidLng: c.longitude,
          polygon: polygon,
          crop: result['crop'],
          soilType: result['soil'],
          waterSource: result['water'],
        );
      } else {
        await DbService.createField(
          name: result['name']!,
          areaAcres: area,
          centroidLat: c.latitude,
          centroidLng: c.longitude,
          polygon: polygon,
          crop: result['crop'],
          soilType: result['soil'],
          waterSource: result['water'],
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        _toast('Save failed: $e');
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final acc = _position?.accuracy;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit field' : 'Draw field'),
        actions: [
          IconButton(
              tooltip: _follow ? 'Following GPS' : 'Follow GPS',
              onPressed: () {
                setState(() => _follow = !_follow);
                if (_follow) _centerOnMe();
              },
              icon: Icon(_follow
                  ? Icons.gps_fixed
                  : Icons.gps_not_fixed)),
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
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'me',
            onPressed: _centerOnMe,
            tooltip: 'Centre on my location',
            child: const Icon(Icons.my_location),
          ),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'gps-corner',
            onPressed: _addPointAtMe,
            icon: const Icon(Icons.add_location_alt_outlined),
            label: const Text('Corner here'),
          ),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            mapType: MapType.hybrid,
            initialCameraPosition: CameraPosition(target: _initial, zoom: 16),
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            onMapCreated: (c) {
              _map = c;
              if (_points.isNotEmpty) {
                _moveCamera(GeoService.centroid(_points), 17);
              }
            },
            onCameraMoveStarted: () {
              if (_follow) setState(() => _follow = false);
            },
            onTap: _onMapTap,
            circles: _position == null
                ? {}
                : {
                    Circle(
                      circleId: const CircleId('accuracy'),
                      center: LatLng(
                          _position!.latitude, _position!.longitude),
                      radius: _position!.accuracy,
                      strokeWidth: 1,
                      strokeColor: kPrimary,
                      fillColor: kPrimary.withOpacity(.12),
                    )
                  },
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
          if (_locating)
            const Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Card(
                child: ListTile(
                  leading: SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                  title: Text('Finding your location…'),
                ),
              ),
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
                          ? 'Tap the map or use “Corner here” to add corners (${_points.length}).'
                          : 'Drag a corner to reshape, tap it to delete, tap an edge to insert.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (acc != null)
                      Text('GPS accuracy: ±${acc.toStringAsFixed(0)} m',
                          style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 8),
                    if (_points.isEmpty)
                      Wrap(
                        spacing: 8,
                        children: [
                          OutlinedButton(
                              onPressed: () => _squareAroundMe(0.5),
                              child: const Text('0.5 acre here')),
                          OutlinedButton(
                              onPressed: () => _squareAroundMe(1),
                              child: const Text('1 acre here')),
                          OutlinedButton(
                              onPressed: () => _squareAroundMe(2),
                              child: const Text('2 acres here')),
                        ],
                      ),
                    const SizedBox(height: 8),
                    Text('Area: ${_acres.toStringAsFixed(3)} acres',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _points.length >= 3 && !_saving ? _save : null,
                      child: _saving
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_isEdit ? 'Update field' : 'Save field'),
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
  const _FieldDetailsDialog({this.name, this.crop, this.soil, this.water});

  final String? name;
  final String? crop;
  final String? soil;
  final String? water;

  @override
  State<_FieldDetailsDialog> createState() => _FieldDetailsDialogState();
}

class _FieldDetailsDialogState extends State<_FieldDetailsDialog> {
  late final _name = TextEditingController(text: widget.name ?? '');
  late final _crop = TextEditingController(text: widget.crop ?? '');
  late final _soil = TextEditingController(text: widget.soil ?? '');
  late final _water = TextEditingController(text: widget.water ?? '');

  @override
  void dispose() {
    _name.dispose();
    _crop.dispose();
    _soil.dispose();
    _water.dispose();
    super.dispose();
  }

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
