import 'dart:convert';
import 'package:drift/drift.dart' as drift;
import '../database/app_database.dart';
import 'spot_card.dart';
import 'walking_route.dart';

/// Represents a single offline spot item adhering strictly to Domain 10 contract.
class OfflineSpotItem {
  final String id;
  final String spotName;
  final String mapsLink;
  final String infoParagraph;
  final String photoUrlsJson;
  final String openHours;
  final String practicalTips;
  final String greetingCard;
  final bool isTouristTrap;
  final int hourlyLimit;
  final int currentVisitors;
  final String vibeTagsJson;
  final double? latitude;
  final double? longitude;
  final bool hasValidCoordinates;

  const OfflineSpotItem({
    required this.id,
    required this.spotName,
    required this.mapsLink,
    required this.infoParagraph,
    required this.photoUrlsJson,
    this.openHours = 'Check Maps for hours',
    this.practicalTips = '',
    this.greetingCard = '',
    this.isTouristTrap = false,
    this.hourlyLimit = 6,
    this.currentVisitors = 0,
    required this.vibeTagsJson,
    this.latitude,
    this.longitude,
    this.hasValidCoordinates = false,
  });

  factory OfflineSpotItem.fromJson(Map<String, dynamic> json) {
    final lat = (json['latitude'] as num?)?.toDouble();
    final lng = (json['longitude'] as num?)?.toDouble();
    final isValid = lat != null &&
        lng != null &&
        lat >= -90.0 &&
        lat <= 90.0 &&
        lng >= -180.0 &&
        lng <= 180.0 &&
        !(lat == 0.0 && lng == 0.0);

    return OfflineSpotItem(
      id: json['id'] as String? ?? '',
      spotName: json['spotName'] as String? ?? '',
      mapsLink: json['mapsLink'] as String? ?? '',
      infoParagraph: json['infoParagraph'] as String? ?? '',
      photoUrlsJson: json['photoUrlsJson'] is String
          ? json['photoUrlsJson'] as String
          : jsonEncode(json['photoUrls'] ?? []),
      openHours: json['openHours'] as String? ?? 'Check Maps for hours',
      practicalTips: json['practicalTips'] as String? ?? '',
      greetingCard: json['greetingCard'] as String? ?? '',
      isTouristTrap: json['isTouristTrap'] as bool? ?? false,
      hourlyLimit: (json['hourlyLimit'] as num?)?.toInt() ?? 6,
      currentVisitors: (json['currentVisitors'] as num?)?.toInt() ?? 0,
      vibeTagsJson: json['vibeTagsJson'] is String
          ? json['vibeTagsJson'] as String
          : jsonEncode(json['vibeTags'] ?? []),
      latitude: lat,
      longitude: lng,
      hasValidCoordinates: isValid,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'spotName': spotName,
      'mapsLink': mapsLink,
      'infoParagraph': infoParagraph,
      'photoUrlsJson': photoUrlsJson,
      'openHours': openHours,
      'practicalTips': practicalTips,
      'greetingCard': greetingCard,
      'isTouristTrap': isTouristTrap,
      'hourlyLimit': hourlyLimit,
      'currentVisitors': currentVisitors,
      'vibeTagsJson': vibeTagsJson,
      'latitude': latitude,
      'longitude': longitude,
    };
  }

  LocalSpotsCompanion toCompanion() {
    return LocalSpotsCompanion.insert(
      id: id,
      spotName: spotName,
      mapsLink: mapsLink,
      infoParagraph: infoParagraph,
      photoUrlsJson: photoUrlsJson,
      openHours: drift.Value(openHours),
      practicalTips: drift.Value(practicalTips),
      greetingCard: drift.Value(greetingCard),
      isTouristTrap: drift.Value(isTouristTrap),
      hourlyLimit: drift.Value(hourlyLimit),
      currentVisitors: drift.Value(currentVisitors),
      vibeTagsJson: vibeTagsJson,
      latitude: drift.Value(latitude),
      longitude: drift.Value(longitude),
      hasValidCoordinates: drift.Value(hasValidCoordinates),
    );
  }

  SpotCard toSpotCard() {
    List<String> photos = [];
    try {
      final decoded = jsonDecode(photoUrlsJson);
      if (decoded is List) photos = decoded.map((e) => e.toString()).toList();
    } catch (_) {}

    List<String> vibes = [];
    try {
      final decoded = jsonDecode(vibeTagsJson);
      if (decoded is List) vibes = decoded.map((e) => e.toString()).toList();
    } catch (_) {}

    return SpotCard(
      id: id,
      spotName: spotName,
      mapsLink: mapsLink,
      infoParagraph: infoParagraph,
      photoUrls: photos,
      openHours: openHours,
      practicalTips: practicalTips,
      greetingCard: greetingCard,
      isTouristTrap: isTouristTrap,
      hourlyLimit: hourlyLimit,
      currentVisitors: currentVisitors,
      vibeTags: vibes,
      latitude: latitude,
      longitude: longitude,
    );
  }
}

/// Represents a downloadable offline pack manifest adhering strictly to Domain 10 contract.
class OfflinePackManifest {
  final String packId;
  final String neighborhood;
  final String city;
  final int version;
  final int totalSpotsCount;
  final int totalRoutesCount;
  final int downloadSizeBytes;
  final String downloadUrl;
  final String sha256Checksum;
  final List<OfflineSpotItem> spots;
  final List<WalkingRoute> routes;
  final String publishedAt;
  final bool isDownloaded;

  const OfflinePackManifest({
    required this.packId,
    required this.neighborhood,
    required this.city,
    required this.version,
    required this.totalSpotsCount,
    required this.totalRoutesCount,
    required this.downloadSizeBytes,
    required this.downloadUrl,
    required this.sha256Checksum,
    this.spots = const [],
    this.routes = const [],
    required this.publishedAt,
    this.isDownloaded = false,
  });

  OfflinePackManifest copyWith({
    String? packId,
    String? neighborhood,
    String? city,
    int? version,
    int? totalSpotsCount,
    int? totalRoutesCount,
    int? downloadSizeBytes,
    String? downloadUrl,
    String? sha256Checksum,
    List<OfflineSpotItem>? spots,
    List<WalkingRoute>? routes,
    String? publishedAt,
    bool? isDownloaded,
  }) {
    return OfflinePackManifest(
      packId: packId ?? this.packId,
      neighborhood: neighborhood ?? this.neighborhood,
      city: city ?? this.city,
      version: version ?? this.version,
      totalSpotsCount: totalSpotsCount ?? this.totalSpotsCount,
      totalRoutesCount: totalRoutesCount ?? this.totalRoutesCount,
      downloadSizeBytes: downloadSizeBytes ?? this.downloadSizeBytes,
      downloadUrl: downloadUrl ?? this.downloadUrl,
      sha256Checksum: sha256Checksum ?? this.sha256Checksum,
      spots: spots ?? this.spots,
      routes: routes ?? this.routes,
      publishedAt: publishedAt ?? this.publishedAt,
      isDownloaded: isDownloaded ?? this.isDownloaded,
    );
  }

  factory OfflinePackManifest.fromJson(Map<String, dynamic> json) {
    final spotsList = (json['spots'] as List?)
            ?.map((s) => OfflineSpotItem.fromJson(s as Map<String, dynamic>))
            .toList() ??
        [];

    final routesList = (json['routes'] as List?)
            ?.map((r) => WalkingRoute.fromJson(r as Map<String, dynamic>))
            .toList() ??
        [];

    return OfflinePackManifest(
      packId: json['packId'] as String? ?? '',
      neighborhood: json['neighborhood'] as String? ?? '',
      city: json['city'] as String? ?? '',
      version: (json['version'] as num?)?.toInt() ?? 1,
      totalSpotsCount: (json['totalSpotsCount'] as num?)?.toInt() ?? spotsList.length,
      totalRoutesCount: (json['totalRoutesCount'] as num?)?.toInt() ?? routesList.length,
      downloadSizeBytes: (json['downloadSizeBytes'] as num?)?.toInt() ?? 0,
      downloadUrl: json['downloadUrl'] as String? ?? '',
      sha256Checksum: json['sha256Checksum'] as String? ?? '',
      spots: spotsList,
      routes: routesList,
      publishedAt: json['publishedAt'] as String? ?? DateTime.now().toUtc().toIso8601String(),
      isDownloaded: json['isDownloaded'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'packId': packId,
      'neighborhood': neighborhood,
      'city': city,
      'version': version,
      'totalSpotsCount': totalSpotsCount,
      'totalRoutesCount': totalRoutesCount,
      'downloadSizeBytes': downloadSizeBytes,
      'downloadUrl': downloadUrl,
      'sha256Checksum': sha256Checksum,
      'spots': spots.map((s) => s.toJson()).toList(),
      'routes': routes.map((r) => r.toJson()).toList(),
      'publishedAt': publishedAt,
    };
  }

  OfflinePacksCompanion toCompanion({required bool isDownloaded, String? downloadedAt}) {
    return OfflinePacksCompanion.insert(
      packId: packId,
      neighborhood: neighborhood,
      city: city,
      version: version,
      totalSpotsCount: totalSpotsCount,
      totalRoutesCount: totalRoutesCount,
      downloadSizeBytes: downloadSizeBytes,
      sha256Checksum: sha256Checksum,
      downloadedAt: downloadedAt ?? DateTime.now().toUtc().toIso8601String(),
      isDownloaded: drift.Value(isDownloaded),
    );
  }
}
