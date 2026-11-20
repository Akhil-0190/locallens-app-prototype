import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'app_database.g.dart';

/// Table representing locally cached neighborhood spots for offline access.
class LocalSpots extends Table {
  TextColumn get id => text()();
  TextColumn get spotName => text()();
  TextColumn get mapsLink => text()();
  TextColumn get infoParagraph => text()();
  TextColumn get photoUrlsJson => text()();
  TextColumn get openHours => text().withDefault(const Constant('Check Maps for hours'))();
  TextColumn get practicalTips => text().withDefault(const Constant(''))();
  TextColumn get greetingCard => text().withDefault(const Constant(''))();
  BoolColumn get isTouristTrap => boolean().withDefault(const Constant(false))();
  IntColumn get hourlyLimit => integer().withDefault(const Constant(6))();
  IntColumn get currentVisitors => integer().withDefault(const Constant(0))();
  TextColumn get vibeTagsJson => text()();

  // Coordinate migration (Domain 10): nullable to prevent 0.0 "Null Island" assignments
  RealColumn get latitude => real().nullable()();
  RealColumn get longitude => real().nullable()();
  BoolColumn get hasValidCoordinates => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Table representing locally cached pedestrian routes (Domain 08).
class LocalRoutes extends Table {
  TextColumn get routeId => text()();
  TextColumn get title => text()();
  TextColumn get neighborhood => text()();
  TextColumn get theme => text()();
  TextColumn get originJson => text()();
  TextColumn get destinationJson => text()();
  TextColumn get waypointsJson => text()();
  TextColumn get waypointPlaceIdsJson => text()();
  TextColumn get optimizedWaypointOrderJson => text()();
  IntColumn get totalDistanceMeters => integer()();
  IntColumn get totalDurationSeconds => integer()();
  TextColumn get formattedDistance => text()();
  TextColumn get formattedDuration => text()();
  TextColumn get encodedPolyline => text()();
  TextColumn get legsJson => text()();
  BoolColumn get isMockData => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text()();
  TextColumn get updatedAt => text()();

  @override
  Set<Column> get primaryKey => {routeId};
}

/// Table tracking downloaded offline packs (Domain 10).
class OfflinePacks extends Table {
  TextColumn get packId => text()();
  TextColumn get neighborhood => text()();
  TextColumn get city => text()();
  IntColumn get version => integer()();
  IntColumn get totalSpotsCount => integer()();
  IntColumn get totalRoutesCount => integer()();
  IntColumn get downloadSizeBytes => integer()();
  TextColumn get sha256Checksum => text()();
  TextColumn get downloadedAt => text()();
  BoolColumn get isDownloaded => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {packId};
}

/// Junction table for many-to-many pack-to-spot association.
class PackSpots extends Table {
  TextColumn get packId => text()();
  TextColumn get spotId => text()();

  @override
  Set<Column> get primaryKey => {packId, spotId};
}

/// Junction table for many-to-many pack-to-route association.
class PackRoutes extends Table {
  TextColumn get packId => text()();
  TextColumn get routeId => text()();

  @override
  Set<Column> get primaryKey => {packId, routeId};
}

@DriftDatabase(tables: [LocalSpots, LocalRoutes, OfflinePacks, PackSpots, PackRoutes])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? e]) : super(e ?? _openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(localSpots, localSpots.latitude);
        await m.addColumn(localSpots, localSpots.longitude);
        await m.addColumn(localSpots, localSpots.hasValidCoordinates);
        await m.createTable(localRoutes);
        await m.createTable(offlinePacks);
        await m.createTable(packSpots);
        await m.createTable(packRoutes);
      }
    },
  );

  static LazyDatabase _openConnection() {
    return LazyDatabase(() async {
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'locallens_offline.sqlite'));
      return NativeDatabase.createInBackground(file);
    });
  }
}
