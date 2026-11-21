// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:latlong2/latlong.dart' as ll;
import '../models/walking_route.dart';
import '../services/native_platform_service.dart';
import '../utils/polyline_decoder.dart';

/// Adaptive Route Map: Renders GoogleMap when online, and automatically
/// falls back to an offline OpenStreetMap canvas (via flutter_map) when
/// connectivity is unavailable.
class AdaptiveRouteMap extends StatefulWidget {
  final WalkingRoute route;
  final gmaps.CameraPosition initialCameraPosition;
  final void Function(gmaps.GoogleMapController)? onMapCreated;
  final Set<gmaps.Marker> markers;
  final Set<gmaps.Polyline> polylines;
  final DeviceNetworkStatus networkStatus;
  final bool enableTileNetworkLoading;

  const AdaptiveRouteMap({
    super.key,
    required this.route,
    required this.initialCameraPosition,
    this.onMapCreated,
    required this.markers,
    required this.polylines,
    this.networkStatus = DeviceNetworkStatus.wifi,
    this.enableTileNetworkLoading = true,
  });

  @override
  State<AdaptiveRouteMap> createState() => _AdaptiveRouteMapState();
}

class _AdaptiveRouteMapState extends State<AdaptiveRouteMap> {
  bool get _isOffline => widget.networkStatus == DeviceNetworkStatus.offline;

  @override
  Widget build(BuildContext context) {
    if (_isOffline) {
      return _buildOfflineMapCanvas();
    }

    // Online Mode: Google Maps SDK
    return gmaps.GoogleMap(
      initialCameraPosition: widget.initialCameraPosition,
      onMapCreated: widget.onMapCreated,
      myLocationEnabled: false,
      zoomControlsEnabled: true,
      polylines: widget.polylines,
      markers: widget.markers,
    );
  }

  /// Builds a Flutter-native offline map canvas using flutter_map
  Widget _buildOfflineMapCanvas() {
    final decodedPoints = PolylineDecoder.decode(widget.route.encodedPolyline);
    final osmPoints = decodedPoints
        .map((p) => ll.LatLng(p.latitude, p.longitude))
        .toList();

    final centerLat = widget.route.origin.latitude;
    final centerLng = widget.route.origin.longitude;

    return Stack(
      children: [
        if (widget.enableTileNetworkLoading)
          FlutterMap(
            options: MapOptions(
              initialCenter: ll.LatLng(centerLat, centerLng),
              initialZoom: 15.5,
              minZoom: 13.0,
              maxZoom: 18.0,
            ),
            children: [
              // OpenStreetMap tile layer (cached locally when pack is installed)
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.innovotribe.locallens',
                fallbackUrl: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ),
              // Decoded Offline Polyline Layer
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: osmPoints,
                    color: Colors.teal.shade800,
                    strokeWidth: 5.0,
                  ),
                ],
              ),
              // Waypoint Markers Layer
              MarkerLayer(
                markers: [
                  // Origin
                  Marker(
                    point: ll.LatLng(widget.route.origin.latitude, widget.route.origin.longitude),
                    width: 36,
                    height: 36,
                    child: const Icon(Icons.location_on, color: Colors.green, size: 36),
                  ),
                  // Waypoints
                  ...widget.route.waypoints.map(
                    (wp) => Marker(
                      point: ll.LatLng(wp.latitude, wp.longitude),
                      width: 32,
                      height: 32,
                      child: const Icon(Icons.place, color: Colors.teal, size: 32),
                    ),
                  ),
                  // Destination
                  Marker(
                    point: ll.LatLng(widget.route.destination.latitude, widget.route.destination.longitude),
                    width: 36,
                    height: 36,
                    child: const Icon(Icons.flag, color: Colors.red, size: 36),
                  ),
                ],
              ),
            ],
          )
        else
          Container(
            color: const Color(0xFFE8ECEF),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.map_outlined, size: 48, color: Colors.teal.shade700),
                  const SizedBox(height: 8),
                  Text(
                    'Offline Route Canvas Active',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.teal.shade900,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${osmPoints.length} route coordinates cached from package',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
          ),
        // Offline Indicator Badge
        Positioned(
          top: 12,
          right: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.teal.shade300, width: 1.5),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.offline_pin, color: Colors.tealAccent, size: 16),
                SizedBox(width: 6),
                Text(
                  'Offline Map Active (OSM Canvas)',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
