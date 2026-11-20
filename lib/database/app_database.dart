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

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [LocalSpots])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? e]) : super(e ?? _openConnection());

  @override
  int get schemaVersion => 1;

  static LazyDatabase _openConnection() {
    return LazyDatabase(() async {
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'locallens_offline.sqlite'));
      return NativeDatabase.createInBackground(file);
    });
  }
}
