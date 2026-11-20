// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $LocalSpotsTable extends LocalSpots
    with TableInfo<$LocalSpotsTable, LocalSpot> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalSpotsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _spotNameMeta = const VerificationMeta(
    'spotName',
  );
  @override
  late final GeneratedColumn<String> spotName = GeneratedColumn<String>(
    'spot_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _mapsLinkMeta = const VerificationMeta(
    'mapsLink',
  );
  @override
  late final GeneratedColumn<String> mapsLink = GeneratedColumn<String>(
    'maps_link',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _infoParagraphMeta = const VerificationMeta(
    'infoParagraph',
  );
  @override
  late final GeneratedColumn<String> infoParagraph = GeneratedColumn<String>(
    'info_paragraph',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _photoUrlsJsonMeta = const VerificationMeta(
    'photoUrlsJson',
  );
  @override
  late final GeneratedColumn<String> photoUrlsJson = GeneratedColumn<String>(
    'photo_urls_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _openHoursMeta = const VerificationMeta(
    'openHours',
  );
  @override
  late final GeneratedColumn<String> openHours = GeneratedColumn<String>(
    'open_hours',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('Check Maps for hours'),
  );
  static const VerificationMeta _practicalTipsMeta = const VerificationMeta(
    'practicalTips',
  );
  @override
  late final GeneratedColumn<String> practicalTips = GeneratedColumn<String>(
    'practical_tips',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _greetingCardMeta = const VerificationMeta(
    'greetingCard',
  );
  @override
  late final GeneratedColumn<String> greetingCard = GeneratedColumn<String>(
    'greeting_card',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _isTouristTrapMeta = const VerificationMeta(
    'isTouristTrap',
  );
  @override
  late final GeneratedColumn<bool> isTouristTrap = GeneratedColumn<bool>(
    'is_tourist_trap',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_tourist_trap" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _hourlyLimitMeta = const VerificationMeta(
    'hourlyLimit',
  );
  @override
  late final GeneratedColumn<int> hourlyLimit = GeneratedColumn<int>(
    'hourly_limit',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(6),
  );
  static const VerificationMeta _currentVisitorsMeta = const VerificationMeta(
    'currentVisitors',
  );
  @override
  late final GeneratedColumn<int> currentVisitors = GeneratedColumn<int>(
    'current_visitors',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _vibeTagsJsonMeta = const VerificationMeta(
    'vibeTagsJson',
  );
  @override
  late final GeneratedColumn<String> vibeTagsJson = GeneratedColumn<String>(
    'vibe_tags_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _latitudeMeta = const VerificationMeta(
    'latitude',
  );
  @override
  late final GeneratedColumn<double> latitude = GeneratedColumn<double>(
    'latitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _longitudeMeta = const VerificationMeta(
    'longitude',
  );
  @override
  late final GeneratedColumn<double> longitude = GeneratedColumn<double>(
    'longitude',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _hasValidCoordinatesMeta =
      const VerificationMeta('hasValidCoordinates');
  @override
  late final GeneratedColumn<bool> hasValidCoordinates = GeneratedColumn<bool>(
    'has_valid_coordinates',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("has_valid_coordinates" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    spotName,
    mapsLink,
    infoParagraph,
    photoUrlsJson,
    openHours,
    practicalTips,
    greetingCard,
    isTouristTrap,
    hourlyLimit,
    currentVisitors,
    vibeTagsJson,
    latitude,
    longitude,
    hasValidCoordinates,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_spots';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalSpot> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('spot_name')) {
      context.handle(
        _spotNameMeta,
        spotName.isAcceptableOrUnknown(data['spot_name']!, _spotNameMeta),
      );
    } else if (isInserting) {
      context.missing(_spotNameMeta);
    }
    if (data.containsKey('maps_link')) {
      context.handle(
        _mapsLinkMeta,
        mapsLink.isAcceptableOrUnknown(data['maps_link']!, _mapsLinkMeta),
      );
    } else if (isInserting) {
      context.missing(_mapsLinkMeta);
    }
    if (data.containsKey('info_paragraph')) {
      context.handle(
        _infoParagraphMeta,
        infoParagraph.isAcceptableOrUnknown(
          data['info_paragraph']!,
          _infoParagraphMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_infoParagraphMeta);
    }
    if (data.containsKey('photo_urls_json')) {
      context.handle(
        _photoUrlsJsonMeta,
        photoUrlsJson.isAcceptableOrUnknown(
          data['photo_urls_json']!,
          _photoUrlsJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_photoUrlsJsonMeta);
    }
    if (data.containsKey('open_hours')) {
      context.handle(
        _openHoursMeta,
        openHours.isAcceptableOrUnknown(data['open_hours']!, _openHoursMeta),
      );
    }
    if (data.containsKey('practical_tips')) {
      context.handle(
        _practicalTipsMeta,
        practicalTips.isAcceptableOrUnknown(
          data['practical_tips']!,
          _practicalTipsMeta,
        ),
      );
    }
    if (data.containsKey('greeting_card')) {
      context.handle(
        _greetingCardMeta,
        greetingCard.isAcceptableOrUnknown(
          data['greeting_card']!,
          _greetingCardMeta,
        ),
      );
    }
    if (data.containsKey('is_tourist_trap')) {
      context.handle(
        _isTouristTrapMeta,
        isTouristTrap.isAcceptableOrUnknown(
          data['is_tourist_trap']!,
          _isTouristTrapMeta,
        ),
      );
    }
    if (data.containsKey('hourly_limit')) {
      context.handle(
        _hourlyLimitMeta,
        hourlyLimit.isAcceptableOrUnknown(
          data['hourly_limit']!,
          _hourlyLimitMeta,
        ),
      );
    }
    if (data.containsKey('current_visitors')) {
      context.handle(
        _currentVisitorsMeta,
        currentVisitors.isAcceptableOrUnknown(
          data['current_visitors']!,
          _currentVisitorsMeta,
        ),
      );
    }
    if (data.containsKey('vibe_tags_json')) {
      context.handle(
        _vibeTagsJsonMeta,
        vibeTagsJson.isAcceptableOrUnknown(
          data['vibe_tags_json']!,
          _vibeTagsJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_vibeTagsJsonMeta);
    }
    if (data.containsKey('latitude')) {
      context.handle(
        _latitudeMeta,
        latitude.isAcceptableOrUnknown(data['latitude']!, _latitudeMeta),
      );
    }
    if (data.containsKey('longitude')) {
      context.handle(
        _longitudeMeta,
        longitude.isAcceptableOrUnknown(data['longitude']!, _longitudeMeta),
      );
    }
    if (data.containsKey('has_valid_coordinates')) {
      context.handle(
        _hasValidCoordinatesMeta,
        hasValidCoordinates.isAcceptableOrUnknown(
          data['has_valid_coordinates']!,
          _hasValidCoordinatesMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalSpot map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalSpot(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      spotName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}spot_name'],
      )!,
      mapsLink: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}maps_link'],
      )!,
      infoParagraph: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}info_paragraph'],
      )!,
      photoUrlsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_urls_json'],
      )!,
      openHours: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}open_hours'],
      )!,
      practicalTips: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}practical_tips'],
      )!,
      greetingCard: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}greeting_card'],
      )!,
      isTouristTrap: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_tourist_trap'],
      )!,
      hourlyLimit: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}hourly_limit'],
      )!,
      currentVisitors: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}current_visitors'],
      )!,
      vibeTagsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}vibe_tags_json'],
      )!,
      latitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}latitude'],
      ),
      longitude: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}longitude'],
      ),
      hasValidCoordinates: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}has_valid_coordinates'],
      )!,
    );
  }

  @override
  $LocalSpotsTable createAlias(String alias) {
    return $LocalSpotsTable(attachedDatabase, alias);
  }
}

class LocalSpot extends DataClass implements Insertable<LocalSpot> {
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
  const LocalSpot({
    required this.id,
    required this.spotName,
    required this.mapsLink,
    required this.infoParagraph,
    required this.photoUrlsJson,
    required this.openHours,
    required this.practicalTips,
    required this.greetingCard,
    required this.isTouristTrap,
    required this.hourlyLimit,
    required this.currentVisitors,
    required this.vibeTagsJson,
    this.latitude,
    this.longitude,
    required this.hasValidCoordinates,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['spot_name'] = Variable<String>(spotName);
    map['maps_link'] = Variable<String>(mapsLink);
    map['info_paragraph'] = Variable<String>(infoParagraph);
    map['photo_urls_json'] = Variable<String>(photoUrlsJson);
    map['open_hours'] = Variable<String>(openHours);
    map['practical_tips'] = Variable<String>(practicalTips);
    map['greeting_card'] = Variable<String>(greetingCard);
    map['is_tourist_trap'] = Variable<bool>(isTouristTrap);
    map['hourly_limit'] = Variable<int>(hourlyLimit);
    map['current_visitors'] = Variable<int>(currentVisitors);
    map['vibe_tags_json'] = Variable<String>(vibeTagsJson);
    if (!nullToAbsent || latitude != null) {
      map['latitude'] = Variable<double>(latitude);
    }
    if (!nullToAbsent || longitude != null) {
      map['longitude'] = Variable<double>(longitude);
    }
    map['has_valid_coordinates'] = Variable<bool>(hasValidCoordinates);
    return map;
  }

  LocalSpotsCompanion toCompanion(bool nullToAbsent) {
    return LocalSpotsCompanion(
      id: Value(id),
      spotName: Value(spotName),
      mapsLink: Value(mapsLink),
      infoParagraph: Value(infoParagraph),
      photoUrlsJson: Value(photoUrlsJson),
      openHours: Value(openHours),
      practicalTips: Value(practicalTips),
      greetingCard: Value(greetingCard),
      isTouristTrap: Value(isTouristTrap),
      hourlyLimit: Value(hourlyLimit),
      currentVisitors: Value(currentVisitors),
      vibeTagsJson: Value(vibeTagsJson),
      latitude: latitude == null && nullToAbsent
          ? const Value.absent()
          : Value(latitude),
      longitude: longitude == null && nullToAbsent
          ? const Value.absent()
          : Value(longitude),
      hasValidCoordinates: Value(hasValidCoordinates),
    );
  }

  factory LocalSpot.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalSpot(
      id: serializer.fromJson<String>(json['id']),
      spotName: serializer.fromJson<String>(json['spotName']),
      mapsLink: serializer.fromJson<String>(json['mapsLink']),
      infoParagraph: serializer.fromJson<String>(json['infoParagraph']),
      photoUrlsJson: serializer.fromJson<String>(json['photoUrlsJson']),
      openHours: serializer.fromJson<String>(json['openHours']),
      practicalTips: serializer.fromJson<String>(json['practicalTips']),
      greetingCard: serializer.fromJson<String>(json['greetingCard']),
      isTouristTrap: serializer.fromJson<bool>(json['isTouristTrap']),
      hourlyLimit: serializer.fromJson<int>(json['hourlyLimit']),
      currentVisitors: serializer.fromJson<int>(json['currentVisitors']),
      vibeTagsJson: serializer.fromJson<String>(json['vibeTagsJson']),
      latitude: serializer.fromJson<double?>(json['latitude']),
      longitude: serializer.fromJson<double?>(json['longitude']),
      hasValidCoordinates: serializer.fromJson<bool>(
        json['hasValidCoordinates'],
      ),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'spotName': serializer.toJson<String>(spotName),
      'mapsLink': serializer.toJson<String>(mapsLink),
      'infoParagraph': serializer.toJson<String>(infoParagraph),
      'photoUrlsJson': serializer.toJson<String>(photoUrlsJson),
      'openHours': serializer.toJson<String>(openHours),
      'practicalTips': serializer.toJson<String>(practicalTips),
      'greetingCard': serializer.toJson<String>(greetingCard),
      'isTouristTrap': serializer.toJson<bool>(isTouristTrap),
      'hourlyLimit': serializer.toJson<int>(hourlyLimit),
      'currentVisitors': serializer.toJson<int>(currentVisitors),
      'vibeTagsJson': serializer.toJson<String>(vibeTagsJson),
      'latitude': serializer.toJson<double?>(latitude),
      'longitude': serializer.toJson<double?>(longitude),
      'hasValidCoordinates': serializer.toJson<bool>(hasValidCoordinates),
    };
  }

  LocalSpot copyWith({
    String? id,
    String? spotName,
    String? mapsLink,
    String? infoParagraph,
    String? photoUrlsJson,
    String? openHours,
    String? practicalTips,
    String? greetingCard,
    bool? isTouristTrap,
    int? hourlyLimit,
    int? currentVisitors,
    String? vibeTagsJson,
    Value<double?> latitude = const Value.absent(),
    Value<double?> longitude = const Value.absent(),
    bool? hasValidCoordinates,
  }) => LocalSpot(
    id: id ?? this.id,
    spotName: spotName ?? this.spotName,
    mapsLink: mapsLink ?? this.mapsLink,
    infoParagraph: infoParagraph ?? this.infoParagraph,
    photoUrlsJson: photoUrlsJson ?? this.photoUrlsJson,
    openHours: openHours ?? this.openHours,
    practicalTips: practicalTips ?? this.practicalTips,
    greetingCard: greetingCard ?? this.greetingCard,
    isTouristTrap: isTouristTrap ?? this.isTouristTrap,
    hourlyLimit: hourlyLimit ?? this.hourlyLimit,
    currentVisitors: currentVisitors ?? this.currentVisitors,
    vibeTagsJson: vibeTagsJson ?? this.vibeTagsJson,
    latitude: latitude.present ? latitude.value : this.latitude,
    longitude: longitude.present ? longitude.value : this.longitude,
    hasValidCoordinates: hasValidCoordinates ?? this.hasValidCoordinates,
  );
  LocalSpot copyWithCompanion(LocalSpotsCompanion data) {
    return LocalSpot(
      id: data.id.present ? data.id.value : this.id,
      spotName: data.spotName.present ? data.spotName.value : this.spotName,
      mapsLink: data.mapsLink.present ? data.mapsLink.value : this.mapsLink,
      infoParagraph: data.infoParagraph.present
          ? data.infoParagraph.value
          : this.infoParagraph,
      photoUrlsJson: data.photoUrlsJson.present
          ? data.photoUrlsJson.value
          : this.photoUrlsJson,
      openHours: data.openHours.present ? data.openHours.value : this.openHours,
      practicalTips: data.practicalTips.present
          ? data.practicalTips.value
          : this.practicalTips,
      greetingCard: data.greetingCard.present
          ? data.greetingCard.value
          : this.greetingCard,
      isTouristTrap: data.isTouristTrap.present
          ? data.isTouristTrap.value
          : this.isTouristTrap,
      hourlyLimit: data.hourlyLimit.present
          ? data.hourlyLimit.value
          : this.hourlyLimit,
      currentVisitors: data.currentVisitors.present
          ? data.currentVisitors.value
          : this.currentVisitors,
      vibeTagsJson: data.vibeTagsJson.present
          ? data.vibeTagsJson.value
          : this.vibeTagsJson,
      latitude: data.latitude.present ? data.latitude.value : this.latitude,
      longitude: data.longitude.present ? data.longitude.value : this.longitude,
      hasValidCoordinates: data.hasValidCoordinates.present
          ? data.hasValidCoordinates.value
          : this.hasValidCoordinates,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalSpot(')
          ..write('id: $id, ')
          ..write('spotName: $spotName, ')
          ..write('mapsLink: $mapsLink, ')
          ..write('infoParagraph: $infoParagraph, ')
          ..write('photoUrlsJson: $photoUrlsJson, ')
          ..write('openHours: $openHours, ')
          ..write('practicalTips: $practicalTips, ')
          ..write('greetingCard: $greetingCard, ')
          ..write('isTouristTrap: $isTouristTrap, ')
          ..write('hourlyLimit: $hourlyLimit, ')
          ..write('currentVisitors: $currentVisitors, ')
          ..write('vibeTagsJson: $vibeTagsJson, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('hasValidCoordinates: $hasValidCoordinates')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    spotName,
    mapsLink,
    infoParagraph,
    photoUrlsJson,
    openHours,
    practicalTips,
    greetingCard,
    isTouristTrap,
    hourlyLimit,
    currentVisitors,
    vibeTagsJson,
    latitude,
    longitude,
    hasValidCoordinates,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalSpot &&
          other.id == this.id &&
          other.spotName == this.spotName &&
          other.mapsLink == this.mapsLink &&
          other.infoParagraph == this.infoParagraph &&
          other.photoUrlsJson == this.photoUrlsJson &&
          other.openHours == this.openHours &&
          other.practicalTips == this.practicalTips &&
          other.greetingCard == this.greetingCard &&
          other.isTouristTrap == this.isTouristTrap &&
          other.hourlyLimit == this.hourlyLimit &&
          other.currentVisitors == this.currentVisitors &&
          other.vibeTagsJson == this.vibeTagsJson &&
          other.latitude == this.latitude &&
          other.longitude == this.longitude &&
          other.hasValidCoordinates == this.hasValidCoordinates);
}

class LocalSpotsCompanion extends UpdateCompanion<LocalSpot> {
  final Value<String> id;
  final Value<String> spotName;
  final Value<String> mapsLink;
  final Value<String> infoParagraph;
  final Value<String> photoUrlsJson;
  final Value<String> openHours;
  final Value<String> practicalTips;
  final Value<String> greetingCard;
  final Value<bool> isTouristTrap;
  final Value<int> hourlyLimit;
  final Value<int> currentVisitors;
  final Value<String> vibeTagsJson;
  final Value<double?> latitude;
  final Value<double?> longitude;
  final Value<bool> hasValidCoordinates;
  final Value<int> rowid;
  const LocalSpotsCompanion({
    this.id = const Value.absent(),
    this.spotName = const Value.absent(),
    this.mapsLink = const Value.absent(),
    this.infoParagraph = const Value.absent(),
    this.photoUrlsJson = const Value.absent(),
    this.openHours = const Value.absent(),
    this.practicalTips = const Value.absent(),
    this.greetingCard = const Value.absent(),
    this.isTouristTrap = const Value.absent(),
    this.hourlyLimit = const Value.absent(),
    this.currentVisitors = const Value.absent(),
    this.vibeTagsJson = const Value.absent(),
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.hasValidCoordinates = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalSpotsCompanion.insert({
    required String id,
    required String spotName,
    required String mapsLink,
    required String infoParagraph,
    required String photoUrlsJson,
    this.openHours = const Value.absent(),
    this.practicalTips = const Value.absent(),
    this.greetingCard = const Value.absent(),
    this.isTouristTrap = const Value.absent(),
    this.hourlyLimit = const Value.absent(),
    this.currentVisitors = const Value.absent(),
    required String vibeTagsJson,
    this.latitude = const Value.absent(),
    this.longitude = const Value.absent(),
    this.hasValidCoordinates = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       spotName = Value(spotName),
       mapsLink = Value(mapsLink),
       infoParagraph = Value(infoParagraph),
       photoUrlsJson = Value(photoUrlsJson),
       vibeTagsJson = Value(vibeTagsJson);
  static Insertable<LocalSpot> custom({
    Expression<String>? id,
    Expression<String>? spotName,
    Expression<String>? mapsLink,
    Expression<String>? infoParagraph,
    Expression<String>? photoUrlsJson,
    Expression<String>? openHours,
    Expression<String>? practicalTips,
    Expression<String>? greetingCard,
    Expression<bool>? isTouristTrap,
    Expression<int>? hourlyLimit,
    Expression<int>? currentVisitors,
    Expression<String>? vibeTagsJson,
    Expression<double>? latitude,
    Expression<double>? longitude,
    Expression<bool>? hasValidCoordinates,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (spotName != null) 'spot_name': spotName,
      if (mapsLink != null) 'maps_link': mapsLink,
      if (infoParagraph != null) 'info_paragraph': infoParagraph,
      if (photoUrlsJson != null) 'photo_urls_json': photoUrlsJson,
      if (openHours != null) 'open_hours': openHours,
      if (practicalTips != null) 'practical_tips': practicalTips,
      if (greetingCard != null) 'greeting_card': greetingCard,
      if (isTouristTrap != null) 'is_tourist_trap': isTouristTrap,
      if (hourlyLimit != null) 'hourly_limit': hourlyLimit,
      if (currentVisitors != null) 'current_visitors': currentVisitors,
      if (vibeTagsJson != null) 'vibe_tags_json': vibeTagsJson,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (hasValidCoordinates != null)
        'has_valid_coordinates': hasValidCoordinates,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalSpotsCompanion copyWith({
    Value<String>? id,
    Value<String>? spotName,
    Value<String>? mapsLink,
    Value<String>? infoParagraph,
    Value<String>? photoUrlsJson,
    Value<String>? openHours,
    Value<String>? practicalTips,
    Value<String>? greetingCard,
    Value<bool>? isTouristTrap,
    Value<int>? hourlyLimit,
    Value<int>? currentVisitors,
    Value<String>? vibeTagsJson,
    Value<double?>? latitude,
    Value<double?>? longitude,
    Value<bool>? hasValidCoordinates,
    Value<int>? rowid,
  }) {
    return LocalSpotsCompanion(
      id: id ?? this.id,
      spotName: spotName ?? this.spotName,
      mapsLink: mapsLink ?? this.mapsLink,
      infoParagraph: infoParagraph ?? this.infoParagraph,
      photoUrlsJson: photoUrlsJson ?? this.photoUrlsJson,
      openHours: openHours ?? this.openHours,
      practicalTips: practicalTips ?? this.practicalTips,
      greetingCard: greetingCard ?? this.greetingCard,
      isTouristTrap: isTouristTrap ?? this.isTouristTrap,
      hourlyLimit: hourlyLimit ?? this.hourlyLimit,
      currentVisitors: currentVisitors ?? this.currentVisitors,
      vibeTagsJson: vibeTagsJson ?? this.vibeTagsJson,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      hasValidCoordinates: hasValidCoordinates ?? this.hasValidCoordinates,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (spotName.present) {
      map['spot_name'] = Variable<String>(spotName.value);
    }
    if (mapsLink.present) {
      map['maps_link'] = Variable<String>(mapsLink.value);
    }
    if (infoParagraph.present) {
      map['info_paragraph'] = Variable<String>(infoParagraph.value);
    }
    if (photoUrlsJson.present) {
      map['photo_urls_json'] = Variable<String>(photoUrlsJson.value);
    }
    if (openHours.present) {
      map['open_hours'] = Variable<String>(openHours.value);
    }
    if (practicalTips.present) {
      map['practical_tips'] = Variable<String>(practicalTips.value);
    }
    if (greetingCard.present) {
      map['greeting_card'] = Variable<String>(greetingCard.value);
    }
    if (isTouristTrap.present) {
      map['is_tourist_trap'] = Variable<bool>(isTouristTrap.value);
    }
    if (hourlyLimit.present) {
      map['hourly_limit'] = Variable<int>(hourlyLimit.value);
    }
    if (currentVisitors.present) {
      map['current_visitors'] = Variable<int>(currentVisitors.value);
    }
    if (vibeTagsJson.present) {
      map['vibe_tags_json'] = Variable<String>(vibeTagsJson.value);
    }
    if (latitude.present) {
      map['latitude'] = Variable<double>(latitude.value);
    }
    if (longitude.present) {
      map['longitude'] = Variable<double>(longitude.value);
    }
    if (hasValidCoordinates.present) {
      map['has_valid_coordinates'] = Variable<bool>(hasValidCoordinates.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalSpotsCompanion(')
          ..write('id: $id, ')
          ..write('spotName: $spotName, ')
          ..write('mapsLink: $mapsLink, ')
          ..write('infoParagraph: $infoParagraph, ')
          ..write('photoUrlsJson: $photoUrlsJson, ')
          ..write('openHours: $openHours, ')
          ..write('practicalTips: $practicalTips, ')
          ..write('greetingCard: $greetingCard, ')
          ..write('isTouristTrap: $isTouristTrap, ')
          ..write('hourlyLimit: $hourlyLimit, ')
          ..write('currentVisitors: $currentVisitors, ')
          ..write('vibeTagsJson: $vibeTagsJson, ')
          ..write('latitude: $latitude, ')
          ..write('longitude: $longitude, ')
          ..write('hasValidCoordinates: $hasValidCoordinates, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalRoutesTable extends LocalRoutes
    with TableInfo<$LocalRoutesTable, LocalRoute> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalRoutesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _routeIdMeta = const VerificationMeta(
    'routeId',
  );
  @override
  late final GeneratedColumn<String> routeId = GeneratedColumn<String>(
    'route_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _neighborhoodMeta = const VerificationMeta(
    'neighborhood',
  );
  @override
  late final GeneratedColumn<String> neighborhood = GeneratedColumn<String>(
    'neighborhood',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _themeMeta = const VerificationMeta('theme');
  @override
  late final GeneratedColumn<String> theme = GeneratedColumn<String>(
    'theme',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _originJsonMeta = const VerificationMeta(
    'originJson',
  );
  @override
  late final GeneratedColumn<String> originJson = GeneratedColumn<String>(
    'origin_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _destinationJsonMeta = const VerificationMeta(
    'destinationJson',
  );
  @override
  late final GeneratedColumn<String> destinationJson = GeneratedColumn<String>(
    'destination_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _waypointsJsonMeta = const VerificationMeta(
    'waypointsJson',
  );
  @override
  late final GeneratedColumn<String> waypointsJson = GeneratedColumn<String>(
    'waypoints_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _waypointPlaceIdsJsonMeta =
      const VerificationMeta('waypointPlaceIdsJson');
  @override
  late final GeneratedColumn<String> waypointPlaceIdsJson =
      GeneratedColumn<String>(
        'waypoint_place_ids_json',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _optimizedWaypointOrderJsonMeta =
      const VerificationMeta('optimizedWaypointOrderJson');
  @override
  late final GeneratedColumn<String> optimizedWaypointOrderJson =
      GeneratedColumn<String>(
        'optimized_waypoint_order_json',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _totalDistanceMetersMeta =
      const VerificationMeta('totalDistanceMeters');
  @override
  late final GeneratedColumn<int> totalDistanceMeters = GeneratedColumn<int>(
    'total_distance_meters',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _totalDurationSecondsMeta =
      const VerificationMeta('totalDurationSeconds');
  @override
  late final GeneratedColumn<int> totalDurationSeconds = GeneratedColumn<int>(
    'total_duration_seconds',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _formattedDistanceMeta = const VerificationMeta(
    'formattedDistance',
  );
  @override
  late final GeneratedColumn<String> formattedDistance =
      GeneratedColumn<String>(
        'formatted_distance',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _formattedDurationMeta = const VerificationMeta(
    'formattedDuration',
  );
  @override
  late final GeneratedColumn<String> formattedDuration =
      GeneratedColumn<String>(
        'formatted_duration',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _encodedPolylineMeta = const VerificationMeta(
    'encodedPolyline',
  );
  @override
  late final GeneratedColumn<String> encodedPolyline = GeneratedColumn<String>(
    'encoded_polyline',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _legsJsonMeta = const VerificationMeta(
    'legsJson',
  );
  @override
  late final GeneratedColumn<String> legsJson = GeneratedColumn<String>(
    'legs_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isMockDataMeta = const VerificationMeta(
    'isMockData',
  );
  @override
  late final GeneratedColumn<bool> isMockData = GeneratedColumn<bool>(
    'is_mock_data',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_mock_data" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    routeId,
    title,
    neighborhood,
    theme,
    originJson,
    destinationJson,
    waypointsJson,
    waypointPlaceIdsJson,
    optimizedWaypointOrderJson,
    totalDistanceMeters,
    totalDurationSeconds,
    formattedDistance,
    formattedDuration,
    encodedPolyline,
    legsJson,
    isMockData,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_routes';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalRoute> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('route_id')) {
      context.handle(
        _routeIdMeta,
        routeId.isAcceptableOrUnknown(data['route_id']!, _routeIdMeta),
      );
    } else if (isInserting) {
      context.missing(_routeIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('neighborhood')) {
      context.handle(
        _neighborhoodMeta,
        neighborhood.isAcceptableOrUnknown(
          data['neighborhood']!,
          _neighborhoodMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_neighborhoodMeta);
    }
    if (data.containsKey('theme')) {
      context.handle(
        _themeMeta,
        theme.isAcceptableOrUnknown(data['theme']!, _themeMeta),
      );
    } else if (isInserting) {
      context.missing(_themeMeta);
    }
    if (data.containsKey('origin_json')) {
      context.handle(
        _originJsonMeta,
        originJson.isAcceptableOrUnknown(data['origin_json']!, _originJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_originJsonMeta);
    }
    if (data.containsKey('destination_json')) {
      context.handle(
        _destinationJsonMeta,
        destinationJson.isAcceptableOrUnknown(
          data['destination_json']!,
          _destinationJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_destinationJsonMeta);
    }
    if (data.containsKey('waypoints_json')) {
      context.handle(
        _waypointsJsonMeta,
        waypointsJson.isAcceptableOrUnknown(
          data['waypoints_json']!,
          _waypointsJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_waypointsJsonMeta);
    }
    if (data.containsKey('waypoint_place_ids_json')) {
      context.handle(
        _waypointPlaceIdsJsonMeta,
        waypointPlaceIdsJson.isAcceptableOrUnknown(
          data['waypoint_place_ids_json']!,
          _waypointPlaceIdsJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_waypointPlaceIdsJsonMeta);
    }
    if (data.containsKey('optimized_waypoint_order_json')) {
      context.handle(
        _optimizedWaypointOrderJsonMeta,
        optimizedWaypointOrderJson.isAcceptableOrUnknown(
          data['optimized_waypoint_order_json']!,
          _optimizedWaypointOrderJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_optimizedWaypointOrderJsonMeta);
    }
    if (data.containsKey('total_distance_meters')) {
      context.handle(
        _totalDistanceMetersMeta,
        totalDistanceMeters.isAcceptableOrUnknown(
          data['total_distance_meters']!,
          _totalDistanceMetersMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_totalDistanceMetersMeta);
    }
    if (data.containsKey('total_duration_seconds')) {
      context.handle(
        _totalDurationSecondsMeta,
        totalDurationSeconds.isAcceptableOrUnknown(
          data['total_duration_seconds']!,
          _totalDurationSecondsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_totalDurationSecondsMeta);
    }
    if (data.containsKey('formatted_distance')) {
      context.handle(
        _formattedDistanceMeta,
        formattedDistance.isAcceptableOrUnknown(
          data['formatted_distance']!,
          _formattedDistanceMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_formattedDistanceMeta);
    }
    if (data.containsKey('formatted_duration')) {
      context.handle(
        _formattedDurationMeta,
        formattedDuration.isAcceptableOrUnknown(
          data['formatted_duration']!,
          _formattedDurationMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_formattedDurationMeta);
    }
    if (data.containsKey('encoded_polyline')) {
      context.handle(
        _encodedPolylineMeta,
        encodedPolyline.isAcceptableOrUnknown(
          data['encoded_polyline']!,
          _encodedPolylineMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_encodedPolylineMeta);
    }
    if (data.containsKey('legs_json')) {
      context.handle(
        _legsJsonMeta,
        legsJson.isAcceptableOrUnknown(data['legs_json']!, _legsJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_legsJsonMeta);
    }
    if (data.containsKey('is_mock_data')) {
      context.handle(
        _isMockDataMeta,
        isMockData.isAcceptableOrUnknown(
          data['is_mock_data']!,
          _isMockDataMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {routeId};
  @override
  LocalRoute map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalRoute(
      routeId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}route_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      neighborhood: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}neighborhood'],
      )!,
      theme: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}theme'],
      )!,
      originJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}origin_json'],
      )!,
      destinationJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}destination_json'],
      )!,
      waypointsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}waypoints_json'],
      )!,
      waypointPlaceIdsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}waypoint_place_ids_json'],
      )!,
      optimizedWaypointOrderJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}optimized_waypoint_order_json'],
      )!,
      totalDistanceMeters: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_distance_meters'],
      )!,
      totalDurationSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_duration_seconds'],
      )!,
      formattedDistance: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}formatted_distance'],
      )!,
      formattedDuration: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}formatted_duration'],
      )!,
      encodedPolyline: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}encoded_polyline'],
      )!,
      legsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}legs_json'],
      )!,
      isMockData: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_mock_data'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $LocalRoutesTable createAlias(String alias) {
    return $LocalRoutesTable(attachedDatabase, alias);
  }
}

class LocalRoute extends DataClass implements Insertable<LocalRoute> {
  final String routeId;
  final String title;
  final String neighborhood;
  final String theme;
  final String originJson;
  final String destinationJson;
  final String waypointsJson;
  final String waypointPlaceIdsJson;
  final String optimizedWaypointOrderJson;
  final int totalDistanceMeters;
  final int totalDurationSeconds;
  final String formattedDistance;
  final String formattedDuration;
  final String encodedPolyline;
  final String legsJson;
  final bool isMockData;
  final String createdAt;
  final String updatedAt;
  const LocalRoute({
    required this.routeId,
    required this.title,
    required this.neighborhood,
    required this.theme,
    required this.originJson,
    required this.destinationJson,
    required this.waypointsJson,
    required this.waypointPlaceIdsJson,
    required this.optimizedWaypointOrderJson,
    required this.totalDistanceMeters,
    required this.totalDurationSeconds,
    required this.formattedDistance,
    required this.formattedDuration,
    required this.encodedPolyline,
    required this.legsJson,
    required this.isMockData,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['route_id'] = Variable<String>(routeId);
    map['title'] = Variable<String>(title);
    map['neighborhood'] = Variable<String>(neighborhood);
    map['theme'] = Variable<String>(theme);
    map['origin_json'] = Variable<String>(originJson);
    map['destination_json'] = Variable<String>(destinationJson);
    map['waypoints_json'] = Variable<String>(waypointsJson);
    map['waypoint_place_ids_json'] = Variable<String>(waypointPlaceIdsJson);
    map['optimized_waypoint_order_json'] = Variable<String>(
      optimizedWaypointOrderJson,
    );
    map['total_distance_meters'] = Variable<int>(totalDistanceMeters);
    map['total_duration_seconds'] = Variable<int>(totalDurationSeconds);
    map['formatted_distance'] = Variable<String>(formattedDistance);
    map['formatted_duration'] = Variable<String>(formattedDuration);
    map['encoded_polyline'] = Variable<String>(encodedPolyline);
    map['legs_json'] = Variable<String>(legsJson);
    map['is_mock_data'] = Variable<bool>(isMockData);
    map['created_at'] = Variable<String>(createdAt);
    map['updated_at'] = Variable<String>(updatedAt);
    return map;
  }

  LocalRoutesCompanion toCompanion(bool nullToAbsent) {
    return LocalRoutesCompanion(
      routeId: Value(routeId),
      title: Value(title),
      neighborhood: Value(neighborhood),
      theme: Value(theme),
      originJson: Value(originJson),
      destinationJson: Value(destinationJson),
      waypointsJson: Value(waypointsJson),
      waypointPlaceIdsJson: Value(waypointPlaceIdsJson),
      optimizedWaypointOrderJson: Value(optimizedWaypointOrderJson),
      totalDistanceMeters: Value(totalDistanceMeters),
      totalDurationSeconds: Value(totalDurationSeconds),
      formattedDistance: Value(formattedDistance),
      formattedDuration: Value(formattedDuration),
      encodedPolyline: Value(encodedPolyline),
      legsJson: Value(legsJson),
      isMockData: Value(isMockData),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory LocalRoute.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalRoute(
      routeId: serializer.fromJson<String>(json['routeId']),
      title: serializer.fromJson<String>(json['title']),
      neighborhood: serializer.fromJson<String>(json['neighborhood']),
      theme: serializer.fromJson<String>(json['theme']),
      originJson: serializer.fromJson<String>(json['originJson']),
      destinationJson: serializer.fromJson<String>(json['destinationJson']),
      waypointsJson: serializer.fromJson<String>(json['waypointsJson']),
      waypointPlaceIdsJson: serializer.fromJson<String>(
        json['waypointPlaceIdsJson'],
      ),
      optimizedWaypointOrderJson: serializer.fromJson<String>(
        json['optimizedWaypointOrderJson'],
      ),
      totalDistanceMeters: serializer.fromJson<int>(
        json['totalDistanceMeters'],
      ),
      totalDurationSeconds: serializer.fromJson<int>(
        json['totalDurationSeconds'],
      ),
      formattedDistance: serializer.fromJson<String>(json['formattedDistance']),
      formattedDuration: serializer.fromJson<String>(json['formattedDuration']),
      encodedPolyline: serializer.fromJson<String>(json['encodedPolyline']),
      legsJson: serializer.fromJson<String>(json['legsJson']),
      isMockData: serializer.fromJson<bool>(json['isMockData']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'routeId': serializer.toJson<String>(routeId),
      'title': serializer.toJson<String>(title),
      'neighborhood': serializer.toJson<String>(neighborhood),
      'theme': serializer.toJson<String>(theme),
      'originJson': serializer.toJson<String>(originJson),
      'destinationJson': serializer.toJson<String>(destinationJson),
      'waypointsJson': serializer.toJson<String>(waypointsJson),
      'waypointPlaceIdsJson': serializer.toJson<String>(waypointPlaceIdsJson),
      'optimizedWaypointOrderJson': serializer.toJson<String>(
        optimizedWaypointOrderJson,
      ),
      'totalDistanceMeters': serializer.toJson<int>(totalDistanceMeters),
      'totalDurationSeconds': serializer.toJson<int>(totalDurationSeconds),
      'formattedDistance': serializer.toJson<String>(formattedDistance),
      'formattedDuration': serializer.toJson<String>(formattedDuration),
      'encodedPolyline': serializer.toJson<String>(encodedPolyline),
      'legsJson': serializer.toJson<String>(legsJson),
      'isMockData': serializer.toJson<bool>(isMockData),
      'createdAt': serializer.toJson<String>(createdAt),
      'updatedAt': serializer.toJson<String>(updatedAt),
    };
  }

  LocalRoute copyWith({
    String? routeId,
    String? title,
    String? neighborhood,
    String? theme,
    String? originJson,
    String? destinationJson,
    String? waypointsJson,
    String? waypointPlaceIdsJson,
    String? optimizedWaypointOrderJson,
    int? totalDistanceMeters,
    int? totalDurationSeconds,
    String? formattedDistance,
    String? formattedDuration,
    String? encodedPolyline,
    String? legsJson,
    bool? isMockData,
    String? createdAt,
    String? updatedAt,
  }) => LocalRoute(
    routeId: routeId ?? this.routeId,
    title: title ?? this.title,
    neighborhood: neighborhood ?? this.neighborhood,
    theme: theme ?? this.theme,
    originJson: originJson ?? this.originJson,
    destinationJson: destinationJson ?? this.destinationJson,
    waypointsJson: waypointsJson ?? this.waypointsJson,
    waypointPlaceIdsJson: waypointPlaceIdsJson ?? this.waypointPlaceIdsJson,
    optimizedWaypointOrderJson:
        optimizedWaypointOrderJson ?? this.optimizedWaypointOrderJson,
    totalDistanceMeters: totalDistanceMeters ?? this.totalDistanceMeters,
    totalDurationSeconds: totalDurationSeconds ?? this.totalDurationSeconds,
    formattedDistance: formattedDistance ?? this.formattedDistance,
    formattedDuration: formattedDuration ?? this.formattedDuration,
    encodedPolyline: encodedPolyline ?? this.encodedPolyline,
    legsJson: legsJson ?? this.legsJson,
    isMockData: isMockData ?? this.isMockData,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  LocalRoute copyWithCompanion(LocalRoutesCompanion data) {
    return LocalRoute(
      routeId: data.routeId.present ? data.routeId.value : this.routeId,
      title: data.title.present ? data.title.value : this.title,
      neighborhood: data.neighborhood.present
          ? data.neighborhood.value
          : this.neighborhood,
      theme: data.theme.present ? data.theme.value : this.theme,
      originJson: data.originJson.present
          ? data.originJson.value
          : this.originJson,
      destinationJson: data.destinationJson.present
          ? data.destinationJson.value
          : this.destinationJson,
      waypointsJson: data.waypointsJson.present
          ? data.waypointsJson.value
          : this.waypointsJson,
      waypointPlaceIdsJson: data.waypointPlaceIdsJson.present
          ? data.waypointPlaceIdsJson.value
          : this.waypointPlaceIdsJson,
      optimizedWaypointOrderJson: data.optimizedWaypointOrderJson.present
          ? data.optimizedWaypointOrderJson.value
          : this.optimizedWaypointOrderJson,
      totalDistanceMeters: data.totalDistanceMeters.present
          ? data.totalDistanceMeters.value
          : this.totalDistanceMeters,
      totalDurationSeconds: data.totalDurationSeconds.present
          ? data.totalDurationSeconds.value
          : this.totalDurationSeconds,
      formattedDistance: data.formattedDistance.present
          ? data.formattedDistance.value
          : this.formattedDistance,
      formattedDuration: data.formattedDuration.present
          ? data.formattedDuration.value
          : this.formattedDuration,
      encodedPolyline: data.encodedPolyline.present
          ? data.encodedPolyline.value
          : this.encodedPolyline,
      legsJson: data.legsJson.present ? data.legsJson.value : this.legsJson,
      isMockData: data.isMockData.present
          ? data.isMockData.value
          : this.isMockData,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalRoute(')
          ..write('routeId: $routeId, ')
          ..write('title: $title, ')
          ..write('neighborhood: $neighborhood, ')
          ..write('theme: $theme, ')
          ..write('originJson: $originJson, ')
          ..write('destinationJson: $destinationJson, ')
          ..write('waypointsJson: $waypointsJson, ')
          ..write('waypointPlaceIdsJson: $waypointPlaceIdsJson, ')
          ..write('optimizedWaypointOrderJson: $optimizedWaypointOrderJson, ')
          ..write('totalDistanceMeters: $totalDistanceMeters, ')
          ..write('totalDurationSeconds: $totalDurationSeconds, ')
          ..write('formattedDistance: $formattedDistance, ')
          ..write('formattedDuration: $formattedDuration, ')
          ..write('encodedPolyline: $encodedPolyline, ')
          ..write('legsJson: $legsJson, ')
          ..write('isMockData: $isMockData, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    routeId,
    title,
    neighborhood,
    theme,
    originJson,
    destinationJson,
    waypointsJson,
    waypointPlaceIdsJson,
    optimizedWaypointOrderJson,
    totalDistanceMeters,
    totalDurationSeconds,
    formattedDistance,
    formattedDuration,
    encodedPolyline,
    legsJson,
    isMockData,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalRoute &&
          other.routeId == this.routeId &&
          other.title == this.title &&
          other.neighborhood == this.neighborhood &&
          other.theme == this.theme &&
          other.originJson == this.originJson &&
          other.destinationJson == this.destinationJson &&
          other.waypointsJson == this.waypointsJson &&
          other.waypointPlaceIdsJson == this.waypointPlaceIdsJson &&
          other.optimizedWaypointOrderJson == this.optimizedWaypointOrderJson &&
          other.totalDistanceMeters == this.totalDistanceMeters &&
          other.totalDurationSeconds == this.totalDurationSeconds &&
          other.formattedDistance == this.formattedDistance &&
          other.formattedDuration == this.formattedDuration &&
          other.encodedPolyline == this.encodedPolyline &&
          other.legsJson == this.legsJson &&
          other.isMockData == this.isMockData &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class LocalRoutesCompanion extends UpdateCompanion<LocalRoute> {
  final Value<String> routeId;
  final Value<String> title;
  final Value<String> neighborhood;
  final Value<String> theme;
  final Value<String> originJson;
  final Value<String> destinationJson;
  final Value<String> waypointsJson;
  final Value<String> waypointPlaceIdsJson;
  final Value<String> optimizedWaypointOrderJson;
  final Value<int> totalDistanceMeters;
  final Value<int> totalDurationSeconds;
  final Value<String> formattedDistance;
  final Value<String> formattedDuration;
  final Value<String> encodedPolyline;
  final Value<String> legsJson;
  final Value<bool> isMockData;
  final Value<String> createdAt;
  final Value<String> updatedAt;
  final Value<int> rowid;
  const LocalRoutesCompanion({
    this.routeId = const Value.absent(),
    this.title = const Value.absent(),
    this.neighborhood = const Value.absent(),
    this.theme = const Value.absent(),
    this.originJson = const Value.absent(),
    this.destinationJson = const Value.absent(),
    this.waypointsJson = const Value.absent(),
    this.waypointPlaceIdsJson = const Value.absent(),
    this.optimizedWaypointOrderJson = const Value.absent(),
    this.totalDistanceMeters = const Value.absent(),
    this.totalDurationSeconds = const Value.absent(),
    this.formattedDistance = const Value.absent(),
    this.formattedDuration = const Value.absent(),
    this.encodedPolyline = const Value.absent(),
    this.legsJson = const Value.absent(),
    this.isMockData = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalRoutesCompanion.insert({
    required String routeId,
    required String title,
    required String neighborhood,
    required String theme,
    required String originJson,
    required String destinationJson,
    required String waypointsJson,
    required String waypointPlaceIdsJson,
    required String optimizedWaypointOrderJson,
    required int totalDistanceMeters,
    required int totalDurationSeconds,
    required String formattedDistance,
    required String formattedDuration,
    required String encodedPolyline,
    required String legsJson,
    this.isMockData = const Value.absent(),
    required String createdAt,
    required String updatedAt,
    this.rowid = const Value.absent(),
  }) : routeId = Value(routeId),
       title = Value(title),
       neighborhood = Value(neighborhood),
       theme = Value(theme),
       originJson = Value(originJson),
       destinationJson = Value(destinationJson),
       waypointsJson = Value(waypointsJson),
       waypointPlaceIdsJson = Value(waypointPlaceIdsJson),
       optimizedWaypointOrderJson = Value(optimizedWaypointOrderJson),
       totalDistanceMeters = Value(totalDistanceMeters),
       totalDurationSeconds = Value(totalDurationSeconds),
       formattedDistance = Value(formattedDistance),
       formattedDuration = Value(formattedDuration),
       encodedPolyline = Value(encodedPolyline),
       legsJson = Value(legsJson),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<LocalRoute> custom({
    Expression<String>? routeId,
    Expression<String>? title,
    Expression<String>? neighborhood,
    Expression<String>? theme,
    Expression<String>? originJson,
    Expression<String>? destinationJson,
    Expression<String>? waypointsJson,
    Expression<String>? waypointPlaceIdsJson,
    Expression<String>? optimizedWaypointOrderJson,
    Expression<int>? totalDistanceMeters,
    Expression<int>? totalDurationSeconds,
    Expression<String>? formattedDistance,
    Expression<String>? formattedDuration,
    Expression<String>? encodedPolyline,
    Expression<String>? legsJson,
    Expression<bool>? isMockData,
    Expression<String>? createdAt,
    Expression<String>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (routeId != null) 'route_id': routeId,
      if (title != null) 'title': title,
      if (neighborhood != null) 'neighborhood': neighborhood,
      if (theme != null) 'theme': theme,
      if (originJson != null) 'origin_json': originJson,
      if (destinationJson != null) 'destination_json': destinationJson,
      if (waypointsJson != null) 'waypoints_json': waypointsJson,
      if (waypointPlaceIdsJson != null)
        'waypoint_place_ids_json': waypointPlaceIdsJson,
      if (optimizedWaypointOrderJson != null)
        'optimized_waypoint_order_json': optimizedWaypointOrderJson,
      if (totalDistanceMeters != null)
        'total_distance_meters': totalDistanceMeters,
      if (totalDurationSeconds != null)
        'total_duration_seconds': totalDurationSeconds,
      if (formattedDistance != null) 'formatted_distance': formattedDistance,
      if (formattedDuration != null) 'formatted_duration': formattedDuration,
      if (encodedPolyline != null) 'encoded_polyline': encodedPolyline,
      if (legsJson != null) 'legs_json': legsJson,
      if (isMockData != null) 'is_mock_data': isMockData,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalRoutesCompanion copyWith({
    Value<String>? routeId,
    Value<String>? title,
    Value<String>? neighborhood,
    Value<String>? theme,
    Value<String>? originJson,
    Value<String>? destinationJson,
    Value<String>? waypointsJson,
    Value<String>? waypointPlaceIdsJson,
    Value<String>? optimizedWaypointOrderJson,
    Value<int>? totalDistanceMeters,
    Value<int>? totalDurationSeconds,
    Value<String>? formattedDistance,
    Value<String>? formattedDuration,
    Value<String>? encodedPolyline,
    Value<String>? legsJson,
    Value<bool>? isMockData,
    Value<String>? createdAt,
    Value<String>? updatedAt,
    Value<int>? rowid,
  }) {
    return LocalRoutesCompanion(
      routeId: routeId ?? this.routeId,
      title: title ?? this.title,
      neighborhood: neighborhood ?? this.neighborhood,
      theme: theme ?? this.theme,
      originJson: originJson ?? this.originJson,
      destinationJson: destinationJson ?? this.destinationJson,
      waypointsJson: waypointsJson ?? this.waypointsJson,
      waypointPlaceIdsJson: waypointPlaceIdsJson ?? this.waypointPlaceIdsJson,
      optimizedWaypointOrderJson:
          optimizedWaypointOrderJson ?? this.optimizedWaypointOrderJson,
      totalDistanceMeters: totalDistanceMeters ?? this.totalDistanceMeters,
      totalDurationSeconds: totalDurationSeconds ?? this.totalDurationSeconds,
      formattedDistance: formattedDistance ?? this.formattedDistance,
      formattedDuration: formattedDuration ?? this.formattedDuration,
      encodedPolyline: encodedPolyline ?? this.encodedPolyline,
      legsJson: legsJson ?? this.legsJson,
      isMockData: isMockData ?? this.isMockData,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (routeId.present) {
      map['route_id'] = Variable<String>(routeId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (neighborhood.present) {
      map['neighborhood'] = Variable<String>(neighborhood.value);
    }
    if (theme.present) {
      map['theme'] = Variable<String>(theme.value);
    }
    if (originJson.present) {
      map['origin_json'] = Variable<String>(originJson.value);
    }
    if (destinationJson.present) {
      map['destination_json'] = Variable<String>(destinationJson.value);
    }
    if (waypointsJson.present) {
      map['waypoints_json'] = Variable<String>(waypointsJson.value);
    }
    if (waypointPlaceIdsJson.present) {
      map['waypoint_place_ids_json'] = Variable<String>(
        waypointPlaceIdsJson.value,
      );
    }
    if (optimizedWaypointOrderJson.present) {
      map['optimized_waypoint_order_json'] = Variable<String>(
        optimizedWaypointOrderJson.value,
      );
    }
    if (totalDistanceMeters.present) {
      map['total_distance_meters'] = Variable<int>(totalDistanceMeters.value);
    }
    if (totalDurationSeconds.present) {
      map['total_duration_seconds'] = Variable<int>(totalDurationSeconds.value);
    }
    if (formattedDistance.present) {
      map['formatted_distance'] = Variable<String>(formattedDistance.value);
    }
    if (formattedDuration.present) {
      map['formatted_duration'] = Variable<String>(formattedDuration.value);
    }
    if (encodedPolyline.present) {
      map['encoded_polyline'] = Variable<String>(encodedPolyline.value);
    }
    if (legsJson.present) {
      map['legs_json'] = Variable<String>(legsJson.value);
    }
    if (isMockData.present) {
      map['is_mock_data'] = Variable<bool>(isMockData.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalRoutesCompanion(')
          ..write('routeId: $routeId, ')
          ..write('title: $title, ')
          ..write('neighborhood: $neighborhood, ')
          ..write('theme: $theme, ')
          ..write('originJson: $originJson, ')
          ..write('destinationJson: $destinationJson, ')
          ..write('waypointsJson: $waypointsJson, ')
          ..write('waypointPlaceIdsJson: $waypointPlaceIdsJson, ')
          ..write('optimizedWaypointOrderJson: $optimizedWaypointOrderJson, ')
          ..write('totalDistanceMeters: $totalDistanceMeters, ')
          ..write('totalDurationSeconds: $totalDurationSeconds, ')
          ..write('formattedDistance: $formattedDistance, ')
          ..write('formattedDuration: $formattedDuration, ')
          ..write('encodedPolyline: $encodedPolyline, ')
          ..write('legsJson: $legsJson, ')
          ..write('isMockData: $isMockData, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OfflinePacksTable extends OfflinePacks
    with TableInfo<$OfflinePacksTable, OfflinePack> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflinePacksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _neighborhoodMeta = const VerificationMeta(
    'neighborhood',
  );
  @override
  late final GeneratedColumn<String> neighborhood = GeneratedColumn<String>(
    'neighborhood',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cityMeta = const VerificationMeta('city');
  @override
  late final GeneratedColumn<String> city = GeneratedColumn<String>(
    'city',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<int> version = GeneratedColumn<int>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _totalSpotsCountMeta = const VerificationMeta(
    'totalSpotsCount',
  );
  @override
  late final GeneratedColumn<int> totalSpotsCount = GeneratedColumn<int>(
    'total_spots_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _totalRoutesCountMeta = const VerificationMeta(
    'totalRoutesCount',
  );
  @override
  late final GeneratedColumn<int> totalRoutesCount = GeneratedColumn<int>(
    'total_routes_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _downloadSizeBytesMeta = const VerificationMeta(
    'downloadSizeBytes',
  );
  @override
  late final GeneratedColumn<int> downloadSizeBytes = GeneratedColumn<int>(
    'download_size_bytes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sha256ChecksumMeta = const VerificationMeta(
    'sha256Checksum',
  );
  @override
  late final GeneratedColumn<String> sha256Checksum = GeneratedColumn<String>(
    'sha256_checksum',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _downloadedAtMeta = const VerificationMeta(
    'downloadedAt',
  );
  @override
  late final GeneratedColumn<String> downloadedAt = GeneratedColumn<String>(
    'downloaded_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _isDownloadedMeta = const VerificationMeta(
    'isDownloaded',
  );
  @override
  late final GeneratedColumn<bool> isDownloaded = GeneratedColumn<bool>(
    'is_downloaded',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_downloaded" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  @override
  List<GeneratedColumn> get $columns => [
    packId,
    neighborhood,
    city,
    version,
    totalSpotsCount,
    totalRoutesCount,
    downloadSizeBytes,
    sha256Checksum,
    downloadedAt,
    isDownloaded,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_packs';
  @override
  VerificationContext validateIntegrity(
    Insertable<OfflinePack> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('neighborhood')) {
      context.handle(
        _neighborhoodMeta,
        neighborhood.isAcceptableOrUnknown(
          data['neighborhood']!,
          _neighborhoodMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_neighborhoodMeta);
    }
    if (data.containsKey('city')) {
      context.handle(
        _cityMeta,
        city.isAcceptableOrUnknown(data['city']!, _cityMeta),
      );
    } else if (isInserting) {
      context.missing(_cityMeta);
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('total_spots_count')) {
      context.handle(
        _totalSpotsCountMeta,
        totalSpotsCount.isAcceptableOrUnknown(
          data['total_spots_count']!,
          _totalSpotsCountMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_totalSpotsCountMeta);
    }
    if (data.containsKey('total_routes_count')) {
      context.handle(
        _totalRoutesCountMeta,
        totalRoutesCount.isAcceptableOrUnknown(
          data['total_routes_count']!,
          _totalRoutesCountMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_totalRoutesCountMeta);
    }
    if (data.containsKey('download_size_bytes')) {
      context.handle(
        _downloadSizeBytesMeta,
        downloadSizeBytes.isAcceptableOrUnknown(
          data['download_size_bytes']!,
          _downloadSizeBytesMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_downloadSizeBytesMeta);
    }
    if (data.containsKey('sha256_checksum')) {
      context.handle(
        _sha256ChecksumMeta,
        sha256Checksum.isAcceptableOrUnknown(
          data['sha256_checksum']!,
          _sha256ChecksumMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_sha256ChecksumMeta);
    }
    if (data.containsKey('downloaded_at')) {
      context.handle(
        _downloadedAtMeta,
        downloadedAt.isAcceptableOrUnknown(
          data['downloaded_at']!,
          _downloadedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_downloadedAtMeta);
    }
    if (data.containsKey('is_downloaded')) {
      context.handle(
        _isDownloadedMeta,
        isDownloaded.isAcceptableOrUnknown(
          data['is_downloaded']!,
          _isDownloadedMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {packId};
  @override
  OfflinePack map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflinePack(
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      neighborhood: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}neighborhood'],
      )!,
      city: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}city'],
      )!,
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}version'],
      )!,
      totalSpotsCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_spots_count'],
      )!,
      totalRoutesCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_routes_count'],
      )!,
      downloadSizeBytes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}download_size_bytes'],
      )!,
      sha256Checksum: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sha256_checksum'],
      )!,
      downloadedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}downloaded_at'],
      )!,
      isDownloaded: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_downloaded'],
      )!,
    );
  }

  @override
  $OfflinePacksTable createAlias(String alias) {
    return $OfflinePacksTable(attachedDatabase, alias);
  }
}

class OfflinePack extends DataClass implements Insertable<OfflinePack> {
  final String packId;
  final String neighborhood;
  final String city;
  final int version;
  final int totalSpotsCount;
  final int totalRoutesCount;
  final int downloadSizeBytes;
  final String sha256Checksum;
  final String downloadedAt;
  final bool isDownloaded;
  const OfflinePack({
    required this.packId,
    required this.neighborhood,
    required this.city,
    required this.version,
    required this.totalSpotsCount,
    required this.totalRoutesCount,
    required this.downloadSizeBytes,
    required this.sha256Checksum,
    required this.downloadedAt,
    required this.isDownloaded,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['pack_id'] = Variable<String>(packId);
    map['neighborhood'] = Variable<String>(neighborhood);
    map['city'] = Variable<String>(city);
    map['version'] = Variable<int>(version);
    map['total_spots_count'] = Variable<int>(totalSpotsCount);
    map['total_routes_count'] = Variable<int>(totalRoutesCount);
    map['download_size_bytes'] = Variable<int>(downloadSizeBytes);
    map['sha256_checksum'] = Variable<String>(sha256Checksum);
    map['downloaded_at'] = Variable<String>(downloadedAt);
    map['is_downloaded'] = Variable<bool>(isDownloaded);
    return map;
  }

  OfflinePacksCompanion toCompanion(bool nullToAbsent) {
    return OfflinePacksCompanion(
      packId: Value(packId),
      neighborhood: Value(neighborhood),
      city: Value(city),
      version: Value(version),
      totalSpotsCount: Value(totalSpotsCount),
      totalRoutesCount: Value(totalRoutesCount),
      downloadSizeBytes: Value(downloadSizeBytes),
      sha256Checksum: Value(sha256Checksum),
      downloadedAt: Value(downloadedAt),
      isDownloaded: Value(isDownloaded),
    );
  }

  factory OfflinePack.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflinePack(
      packId: serializer.fromJson<String>(json['packId']),
      neighborhood: serializer.fromJson<String>(json['neighborhood']),
      city: serializer.fromJson<String>(json['city']),
      version: serializer.fromJson<int>(json['version']),
      totalSpotsCount: serializer.fromJson<int>(json['totalSpotsCount']),
      totalRoutesCount: serializer.fromJson<int>(json['totalRoutesCount']),
      downloadSizeBytes: serializer.fromJson<int>(json['downloadSizeBytes']),
      sha256Checksum: serializer.fromJson<String>(json['sha256Checksum']),
      downloadedAt: serializer.fromJson<String>(json['downloadedAt']),
      isDownloaded: serializer.fromJson<bool>(json['isDownloaded']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'packId': serializer.toJson<String>(packId),
      'neighborhood': serializer.toJson<String>(neighborhood),
      'city': serializer.toJson<String>(city),
      'version': serializer.toJson<int>(version),
      'totalSpotsCount': serializer.toJson<int>(totalSpotsCount),
      'totalRoutesCount': serializer.toJson<int>(totalRoutesCount),
      'downloadSizeBytes': serializer.toJson<int>(downloadSizeBytes),
      'sha256Checksum': serializer.toJson<String>(sha256Checksum),
      'downloadedAt': serializer.toJson<String>(downloadedAt),
      'isDownloaded': serializer.toJson<bool>(isDownloaded),
    };
  }

  OfflinePack copyWith({
    String? packId,
    String? neighborhood,
    String? city,
    int? version,
    int? totalSpotsCount,
    int? totalRoutesCount,
    int? downloadSizeBytes,
    String? sha256Checksum,
    String? downloadedAt,
    bool? isDownloaded,
  }) => OfflinePack(
    packId: packId ?? this.packId,
    neighborhood: neighborhood ?? this.neighborhood,
    city: city ?? this.city,
    version: version ?? this.version,
    totalSpotsCount: totalSpotsCount ?? this.totalSpotsCount,
    totalRoutesCount: totalRoutesCount ?? this.totalRoutesCount,
    downloadSizeBytes: downloadSizeBytes ?? this.downloadSizeBytes,
    sha256Checksum: sha256Checksum ?? this.sha256Checksum,
    downloadedAt: downloadedAt ?? this.downloadedAt,
    isDownloaded: isDownloaded ?? this.isDownloaded,
  );
  OfflinePack copyWithCompanion(OfflinePacksCompanion data) {
    return OfflinePack(
      packId: data.packId.present ? data.packId.value : this.packId,
      neighborhood: data.neighborhood.present
          ? data.neighborhood.value
          : this.neighborhood,
      city: data.city.present ? data.city.value : this.city,
      version: data.version.present ? data.version.value : this.version,
      totalSpotsCount: data.totalSpotsCount.present
          ? data.totalSpotsCount.value
          : this.totalSpotsCount,
      totalRoutesCount: data.totalRoutesCount.present
          ? data.totalRoutesCount.value
          : this.totalRoutesCount,
      downloadSizeBytes: data.downloadSizeBytes.present
          ? data.downloadSizeBytes.value
          : this.downloadSizeBytes,
      sha256Checksum: data.sha256Checksum.present
          ? data.sha256Checksum.value
          : this.sha256Checksum,
      downloadedAt: data.downloadedAt.present
          ? data.downloadedAt.value
          : this.downloadedAt,
      isDownloaded: data.isDownloaded.present
          ? data.isDownloaded.value
          : this.isDownloaded,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePack(')
          ..write('packId: $packId, ')
          ..write('neighborhood: $neighborhood, ')
          ..write('city: $city, ')
          ..write('version: $version, ')
          ..write('totalSpotsCount: $totalSpotsCount, ')
          ..write('totalRoutesCount: $totalRoutesCount, ')
          ..write('downloadSizeBytes: $downloadSizeBytes, ')
          ..write('sha256Checksum: $sha256Checksum, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('isDownloaded: $isDownloaded')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    packId,
    neighborhood,
    city,
    version,
    totalSpotsCount,
    totalRoutesCount,
    downloadSizeBytes,
    sha256Checksum,
    downloadedAt,
    isDownloaded,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflinePack &&
          other.packId == this.packId &&
          other.neighborhood == this.neighborhood &&
          other.city == this.city &&
          other.version == this.version &&
          other.totalSpotsCount == this.totalSpotsCount &&
          other.totalRoutesCount == this.totalRoutesCount &&
          other.downloadSizeBytes == this.downloadSizeBytes &&
          other.sha256Checksum == this.sha256Checksum &&
          other.downloadedAt == this.downloadedAt &&
          other.isDownloaded == this.isDownloaded);
}

class OfflinePacksCompanion extends UpdateCompanion<OfflinePack> {
  final Value<String> packId;
  final Value<String> neighborhood;
  final Value<String> city;
  final Value<int> version;
  final Value<int> totalSpotsCount;
  final Value<int> totalRoutesCount;
  final Value<int> downloadSizeBytes;
  final Value<String> sha256Checksum;
  final Value<String> downloadedAt;
  final Value<bool> isDownloaded;
  final Value<int> rowid;
  const OfflinePacksCompanion({
    this.packId = const Value.absent(),
    this.neighborhood = const Value.absent(),
    this.city = const Value.absent(),
    this.version = const Value.absent(),
    this.totalSpotsCount = const Value.absent(),
    this.totalRoutesCount = const Value.absent(),
    this.downloadSizeBytes = const Value.absent(),
    this.sha256Checksum = const Value.absent(),
    this.downloadedAt = const Value.absent(),
    this.isDownloaded = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflinePacksCompanion.insert({
    required String packId,
    required String neighborhood,
    required String city,
    required int version,
    required int totalSpotsCount,
    required int totalRoutesCount,
    required int downloadSizeBytes,
    required String sha256Checksum,
    required String downloadedAt,
    this.isDownloaded = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : packId = Value(packId),
       neighborhood = Value(neighborhood),
       city = Value(city),
       version = Value(version),
       totalSpotsCount = Value(totalSpotsCount),
       totalRoutesCount = Value(totalRoutesCount),
       downloadSizeBytes = Value(downloadSizeBytes),
       sha256Checksum = Value(sha256Checksum),
       downloadedAt = Value(downloadedAt);
  static Insertable<OfflinePack> custom({
    Expression<String>? packId,
    Expression<String>? neighborhood,
    Expression<String>? city,
    Expression<int>? version,
    Expression<int>? totalSpotsCount,
    Expression<int>? totalRoutesCount,
    Expression<int>? downloadSizeBytes,
    Expression<String>? sha256Checksum,
    Expression<String>? downloadedAt,
    Expression<bool>? isDownloaded,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (packId != null) 'pack_id': packId,
      if (neighborhood != null) 'neighborhood': neighborhood,
      if (city != null) 'city': city,
      if (version != null) 'version': version,
      if (totalSpotsCount != null) 'total_spots_count': totalSpotsCount,
      if (totalRoutesCount != null) 'total_routes_count': totalRoutesCount,
      if (downloadSizeBytes != null) 'download_size_bytes': downloadSizeBytes,
      if (sha256Checksum != null) 'sha256_checksum': sha256Checksum,
      if (downloadedAt != null) 'downloaded_at': downloadedAt,
      if (isDownloaded != null) 'is_downloaded': isDownloaded,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflinePacksCompanion copyWith({
    Value<String>? packId,
    Value<String>? neighborhood,
    Value<String>? city,
    Value<int>? version,
    Value<int>? totalSpotsCount,
    Value<int>? totalRoutesCount,
    Value<int>? downloadSizeBytes,
    Value<String>? sha256Checksum,
    Value<String>? downloadedAt,
    Value<bool>? isDownloaded,
    Value<int>? rowid,
  }) {
    return OfflinePacksCompanion(
      packId: packId ?? this.packId,
      neighborhood: neighborhood ?? this.neighborhood,
      city: city ?? this.city,
      version: version ?? this.version,
      totalSpotsCount: totalSpotsCount ?? this.totalSpotsCount,
      totalRoutesCount: totalRoutesCount ?? this.totalRoutesCount,
      downloadSizeBytes: downloadSizeBytes ?? this.downloadSizeBytes,
      sha256Checksum: sha256Checksum ?? this.sha256Checksum,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      isDownloaded: isDownloaded ?? this.isDownloaded,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (neighborhood.present) {
      map['neighborhood'] = Variable<String>(neighborhood.value);
    }
    if (city.present) {
      map['city'] = Variable<String>(city.value);
    }
    if (version.present) {
      map['version'] = Variable<int>(version.value);
    }
    if (totalSpotsCount.present) {
      map['total_spots_count'] = Variable<int>(totalSpotsCount.value);
    }
    if (totalRoutesCount.present) {
      map['total_routes_count'] = Variable<int>(totalRoutesCount.value);
    }
    if (downloadSizeBytes.present) {
      map['download_size_bytes'] = Variable<int>(downloadSizeBytes.value);
    }
    if (sha256Checksum.present) {
      map['sha256_checksum'] = Variable<String>(sha256Checksum.value);
    }
    if (downloadedAt.present) {
      map['downloaded_at'] = Variable<String>(downloadedAt.value);
    }
    if (isDownloaded.present) {
      map['is_downloaded'] = Variable<bool>(isDownloaded.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePacksCompanion(')
          ..write('packId: $packId, ')
          ..write('neighborhood: $neighborhood, ')
          ..write('city: $city, ')
          ..write('version: $version, ')
          ..write('totalSpotsCount: $totalSpotsCount, ')
          ..write('totalRoutesCount: $totalRoutesCount, ')
          ..write('downloadSizeBytes: $downloadSizeBytes, ')
          ..write('sha256Checksum: $sha256Checksum, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('isDownloaded: $isDownloaded, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PackSpotsTable extends PackSpots
    with TableInfo<$PackSpotsTable, PackSpot> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PackSpotsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _spotIdMeta = const VerificationMeta('spotId');
  @override
  late final GeneratedColumn<String> spotId = GeneratedColumn<String>(
    'spot_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [packId, spotId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pack_spots';
  @override
  VerificationContext validateIntegrity(
    Insertable<PackSpot> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('spot_id')) {
      context.handle(
        _spotIdMeta,
        spotId.isAcceptableOrUnknown(data['spot_id']!, _spotIdMeta),
      );
    } else if (isInserting) {
      context.missing(_spotIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {packId, spotId};
  @override
  PackSpot map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PackSpot(
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      spotId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}spot_id'],
      )!,
    );
  }

  @override
  $PackSpotsTable createAlias(String alias) {
    return $PackSpotsTable(attachedDatabase, alias);
  }
}

class PackSpot extends DataClass implements Insertable<PackSpot> {
  final String packId;
  final String spotId;
  const PackSpot({required this.packId, required this.spotId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['pack_id'] = Variable<String>(packId);
    map['spot_id'] = Variable<String>(spotId);
    return map;
  }

  PackSpotsCompanion toCompanion(bool nullToAbsent) {
    return PackSpotsCompanion(packId: Value(packId), spotId: Value(spotId));
  }

  factory PackSpot.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PackSpot(
      packId: serializer.fromJson<String>(json['packId']),
      spotId: serializer.fromJson<String>(json['spotId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'packId': serializer.toJson<String>(packId),
      'spotId': serializer.toJson<String>(spotId),
    };
  }

  PackSpot copyWith({String? packId, String? spotId}) =>
      PackSpot(packId: packId ?? this.packId, spotId: spotId ?? this.spotId);
  PackSpot copyWithCompanion(PackSpotsCompanion data) {
    return PackSpot(
      packId: data.packId.present ? data.packId.value : this.packId,
      spotId: data.spotId.present ? data.spotId.value : this.spotId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PackSpot(')
          ..write('packId: $packId, ')
          ..write('spotId: $spotId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(packId, spotId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PackSpot &&
          other.packId == this.packId &&
          other.spotId == this.spotId);
}

class PackSpotsCompanion extends UpdateCompanion<PackSpot> {
  final Value<String> packId;
  final Value<String> spotId;
  final Value<int> rowid;
  const PackSpotsCompanion({
    this.packId = const Value.absent(),
    this.spotId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PackSpotsCompanion.insert({
    required String packId,
    required String spotId,
    this.rowid = const Value.absent(),
  }) : packId = Value(packId),
       spotId = Value(spotId);
  static Insertable<PackSpot> custom({
    Expression<String>? packId,
    Expression<String>? spotId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (packId != null) 'pack_id': packId,
      if (spotId != null) 'spot_id': spotId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PackSpotsCompanion copyWith({
    Value<String>? packId,
    Value<String>? spotId,
    Value<int>? rowid,
  }) {
    return PackSpotsCompanion(
      packId: packId ?? this.packId,
      spotId: spotId ?? this.spotId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (spotId.present) {
      map['spot_id'] = Variable<String>(spotId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PackSpotsCompanion(')
          ..write('packId: $packId, ')
          ..write('spotId: $spotId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PackRoutesTable extends PackRoutes
    with TableInfo<$PackRoutesTable, PackRoute> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PackRoutesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _routeIdMeta = const VerificationMeta(
    'routeId',
  );
  @override
  late final GeneratedColumn<String> routeId = GeneratedColumn<String>(
    'route_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [packId, routeId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pack_routes';
  @override
  VerificationContext validateIntegrity(
    Insertable<PackRoute> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('route_id')) {
      context.handle(
        _routeIdMeta,
        routeId.isAcceptableOrUnknown(data['route_id']!, _routeIdMeta),
      );
    } else if (isInserting) {
      context.missing(_routeIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {packId, routeId};
  @override
  PackRoute map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PackRoute(
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      routeId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}route_id'],
      )!,
    );
  }

  @override
  $PackRoutesTable createAlias(String alias) {
    return $PackRoutesTable(attachedDatabase, alias);
  }
}

class PackRoute extends DataClass implements Insertable<PackRoute> {
  final String packId;
  final String routeId;
  const PackRoute({required this.packId, required this.routeId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['pack_id'] = Variable<String>(packId);
    map['route_id'] = Variable<String>(routeId);
    return map;
  }

  PackRoutesCompanion toCompanion(bool nullToAbsent) {
    return PackRoutesCompanion(packId: Value(packId), routeId: Value(routeId));
  }

  factory PackRoute.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PackRoute(
      packId: serializer.fromJson<String>(json['packId']),
      routeId: serializer.fromJson<String>(json['routeId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'packId': serializer.toJson<String>(packId),
      'routeId': serializer.toJson<String>(routeId),
    };
  }

  PackRoute copyWith({String? packId, String? routeId}) => PackRoute(
    packId: packId ?? this.packId,
    routeId: routeId ?? this.routeId,
  );
  PackRoute copyWithCompanion(PackRoutesCompanion data) {
    return PackRoute(
      packId: data.packId.present ? data.packId.value : this.packId,
      routeId: data.routeId.present ? data.routeId.value : this.routeId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PackRoute(')
          ..write('packId: $packId, ')
          ..write('routeId: $routeId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(packId, routeId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PackRoute &&
          other.packId == this.packId &&
          other.routeId == this.routeId);
}

class PackRoutesCompanion extends UpdateCompanion<PackRoute> {
  final Value<String> packId;
  final Value<String> routeId;
  final Value<int> rowid;
  const PackRoutesCompanion({
    this.packId = const Value.absent(),
    this.routeId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PackRoutesCompanion.insert({
    required String packId,
    required String routeId,
    this.rowid = const Value.absent(),
  }) : packId = Value(packId),
       routeId = Value(routeId);
  static Insertable<PackRoute> custom({
    Expression<String>? packId,
    Expression<String>? routeId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (packId != null) 'pack_id': packId,
      if (routeId != null) 'route_id': routeId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PackRoutesCompanion copyWith({
    Value<String>? packId,
    Value<String>? routeId,
    Value<int>? rowid,
  }) {
    return PackRoutesCompanion(
      packId: packId ?? this.packId,
      routeId: routeId ?? this.routeId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (routeId.present) {
      map['route_id'] = Variable<String>(routeId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PackRoutesCompanion(')
          ..write('packId: $packId, ')
          ..write('routeId: $routeId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $LocalSpotsTable localSpots = $LocalSpotsTable(this);
  late final $LocalRoutesTable localRoutes = $LocalRoutesTable(this);
  late final $OfflinePacksTable offlinePacks = $OfflinePacksTable(this);
  late final $PackSpotsTable packSpots = $PackSpotsTable(this);
  late final $PackRoutesTable packRoutes = $PackRoutesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    localSpots,
    localRoutes,
    offlinePacks,
    packSpots,
    packRoutes,
  ];
}

typedef $$LocalSpotsTableCreateCompanionBuilder = LocalSpotsCompanion Function({
  required String id,
  required String spotName,
  required String mapsLink,
  required String infoParagraph,
  required String photoUrlsJson,
  Value<String> openHours,
  Value<String> practicalTips,
  Value<String> greetingCard,
  Value<bool> isTouristTrap,
  Value<int> hourlyLimit,
  Value<int> currentVisitors,
  required String vibeTagsJson,
  Value<double?> latitude,
  Value<double?> longitude,
  Value<bool> hasValidCoordinates,
  Value<int> rowid,
});
typedef $$LocalSpotsTableUpdateCompanionBuilder = LocalSpotsCompanion Function({
  Value<String> id,
  Value<String> spotName,
  Value<String> mapsLink,
  Value<String> infoParagraph,
  Value<String> photoUrlsJson,
  Value<String> openHours,
  Value<String> practicalTips,
  Value<String> greetingCard,
  Value<bool> isTouristTrap,
  Value<int> hourlyLimit,
  Value<int> currentVisitors,
  Value<String> vibeTagsJson,
  Value<double?> latitude,
  Value<double?> longitude,
  Value<bool> hasValidCoordinates,
  Value<int> rowid,
});

class $$LocalSpotsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalSpotsTable> {
  $$LocalSpotsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get spotName => $composableBuilder(
    column: $table.spotName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mapsLink => $composableBuilder(
    column: $table.mapsLink,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get infoParagraph => $composableBuilder(
    column: $table.infoParagraph,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoUrlsJson => $composableBuilder(
    column: $table.photoUrlsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get openHours => $composableBuilder(
    column: $table.openHours,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get practicalTips => $composableBuilder(
    column: $table.practicalTips,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get greetingCard => $composableBuilder(
    column: $table.greetingCard,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isTouristTrap => $composableBuilder(
    column: $table.isTouristTrap,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get hourlyLimit => $composableBuilder(
    column: $table.hourlyLimit,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get currentVisitors => $composableBuilder(
    column: $table.currentVisitors,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get vibeTagsJson => $composableBuilder(
    column: $table.vibeTagsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get hasValidCoordinates => $composableBuilder(
    column: $table.hasValidCoordinates,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalSpotsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalSpotsTable> {
  $$LocalSpotsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get spotName => $composableBuilder(
    column: $table.spotName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mapsLink => $composableBuilder(
    column: $table.mapsLink,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get infoParagraph => $composableBuilder(
    column: $table.infoParagraph,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoUrlsJson => $composableBuilder(
    column: $table.photoUrlsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get openHours => $composableBuilder(
    column: $table.openHours,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get practicalTips => $composableBuilder(
    column: $table.practicalTips,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get greetingCard => $composableBuilder(
    column: $table.greetingCard,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isTouristTrap => $composableBuilder(
    column: $table.isTouristTrap,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get hourlyLimit => $composableBuilder(
    column: $table.hourlyLimit,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get currentVisitors => $composableBuilder(
    column: $table.currentVisitors,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get vibeTagsJson => $composableBuilder(
    column: $table.vibeTagsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get latitude => $composableBuilder(
    column: $table.latitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get longitude => $composableBuilder(
    column: $table.longitude,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get hasValidCoordinates => $composableBuilder(
    column: $table.hasValidCoordinates,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalSpotsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalSpotsTable> {
  $$LocalSpotsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get spotName =>
      $composableBuilder(column: $table.spotName, builder: (column) => column);

  GeneratedColumn<String> get mapsLink =>
      $composableBuilder(column: $table.mapsLink, builder: (column) => column);

  GeneratedColumn<String> get infoParagraph => $composableBuilder(
    column: $table.infoParagraph,
    builder: (column) => column,
  );

  GeneratedColumn<String> get photoUrlsJson => $composableBuilder(
    column: $table.photoUrlsJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get openHours =>
      $composableBuilder(column: $table.openHours, builder: (column) => column);

  GeneratedColumn<String> get practicalTips => $composableBuilder(
    column: $table.practicalTips,
    builder: (column) => column,
  );

  GeneratedColumn<String> get greetingCard => $composableBuilder(
    column: $table.greetingCard,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isTouristTrap => $composableBuilder(
    column: $table.isTouristTrap,
    builder: (column) => column,
  );

  GeneratedColumn<int> get hourlyLimit => $composableBuilder(
    column: $table.hourlyLimit,
    builder: (column) => column,
  );

  GeneratedColumn<int> get currentVisitors => $composableBuilder(
    column: $table.currentVisitors,
    builder: (column) => column,
  );

  GeneratedColumn<String> get vibeTagsJson => $composableBuilder(
    column: $table.vibeTagsJson,
    builder: (column) => column,
  );

  GeneratedColumn<double> get latitude =>
      $composableBuilder(column: $table.latitude, builder: (column) => column);

  GeneratedColumn<double> get longitude =>
      $composableBuilder(column: $table.longitude, builder: (column) => column);

  GeneratedColumn<bool> get hasValidCoordinates => $composableBuilder(
    column: $table.hasValidCoordinates,
    builder: (column) => column,
  );
}

class $$LocalSpotsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalSpotsTable,
          LocalSpot,
          $$LocalSpotsTableFilterComposer,
          $$LocalSpotsTableOrderingComposer,
          $$LocalSpotsTableAnnotationComposer,
          $$LocalSpotsTableCreateCompanionBuilder,
          $$LocalSpotsTableUpdateCompanionBuilder,
          (
            LocalSpot,
            BaseReferences<_$AppDatabase, $LocalSpotsTable, LocalSpot>,
          ),
          LocalSpot,
          PrefetchHooks Function()
        > {
  $$LocalSpotsTableTableManager(_$AppDatabase db, $LocalSpotsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalSpotsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalSpotsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalSpotsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> spotName = const Value.absent(),
                Value<String> mapsLink = const Value.absent(),
                Value<String> infoParagraph = const Value.absent(),
                Value<String> photoUrlsJson = const Value.absent(),
                Value<String> openHours = const Value.absent(),
                Value<String> practicalTips = const Value.absent(),
                Value<String> greetingCard = const Value.absent(),
                Value<bool> isTouristTrap = const Value.absent(),
                Value<int> hourlyLimit = const Value.absent(),
                Value<int> currentVisitors = const Value.absent(),
                Value<String> vibeTagsJson = const Value.absent(),
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<bool> hasValidCoordinates = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalSpotsCompanion(
                id: id,
                spotName: spotName,
                mapsLink: mapsLink,
                infoParagraph: infoParagraph,
                photoUrlsJson: photoUrlsJson,
                openHours: openHours,
                practicalTips: practicalTips,
                greetingCard: greetingCard,
                isTouristTrap: isTouristTrap,
                hourlyLimit: hourlyLimit,
                currentVisitors: currentVisitors,
                vibeTagsJson: vibeTagsJson,
                latitude: latitude,
                longitude: longitude,
                hasValidCoordinates: hasValidCoordinates,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String spotName,
                required String mapsLink,
                required String infoParagraph,
                required String photoUrlsJson,
                Value<String> openHours = const Value.absent(),
                Value<String> practicalTips = const Value.absent(),
                Value<String> greetingCard = const Value.absent(),
                Value<bool> isTouristTrap = const Value.absent(),
                Value<int> hourlyLimit = const Value.absent(),
                Value<int> currentVisitors = const Value.absent(),
                required String vibeTagsJson,
                Value<double?> latitude = const Value.absent(),
                Value<double?> longitude = const Value.absent(),
                Value<bool> hasValidCoordinates = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalSpotsCompanion.insert(
                id: id,
                spotName: spotName,
                mapsLink: mapsLink,
                infoParagraph: infoParagraph,
                photoUrlsJson: photoUrlsJson,
                openHours: openHours,
                practicalTips: practicalTips,
                greetingCard: greetingCard,
                isTouristTrap: isTouristTrap,
                hourlyLimit: hourlyLimit,
                currentVisitors: currentVisitors,
                vibeTagsJson: vibeTagsJson,
                latitude: latitude,
                longitude: longitude,
                hasValidCoordinates: hasValidCoordinates,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalSpotsTable, LocalSpot>(table),
                  BaseReferences<_$AppDatabase, $LocalSpotsTable, LocalSpot>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalSpotsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalSpotsTable,
      LocalSpot,
      $$LocalSpotsTableFilterComposer,
      $$LocalSpotsTableOrderingComposer,
      $$LocalSpotsTableAnnotationComposer,
      $$LocalSpotsTableCreateCompanionBuilder,
      $$LocalSpotsTableUpdateCompanionBuilder,
      (LocalSpot, BaseReferences<_$AppDatabase, $LocalSpotsTable, LocalSpot>),
      LocalSpot,
      PrefetchHooks Function()
    >;
typedef $$LocalRoutesTableCreateCompanionBuilder =
    LocalRoutesCompanion Function({
      required String routeId,
      required String title,
      required String neighborhood,
      required String theme,
      required String originJson,
      required String destinationJson,
      required String waypointsJson,
      required String waypointPlaceIdsJson,
      required String optimizedWaypointOrderJson,
      required int totalDistanceMeters,
      required int totalDurationSeconds,
      required String formattedDistance,
      required String formattedDuration,
      required String encodedPolyline,
      required String legsJson,
      Value<bool> isMockData,
      required String createdAt,
      required String updatedAt,
      Value<int> rowid,
    });
typedef $$LocalRoutesTableUpdateCompanionBuilder =
    LocalRoutesCompanion Function({
      Value<String> routeId,
      Value<String> title,
      Value<String> neighborhood,
      Value<String> theme,
      Value<String> originJson,
      Value<String> destinationJson,
      Value<String> waypointsJson,
      Value<String> waypointPlaceIdsJson,
      Value<String> optimizedWaypointOrderJson,
      Value<int> totalDistanceMeters,
      Value<int> totalDurationSeconds,
      Value<String> formattedDistance,
      Value<String> formattedDuration,
      Value<String> encodedPolyline,
      Value<String> legsJson,
      Value<bool> isMockData,
      Value<String> createdAt,
      Value<String> updatedAt,
      Value<int> rowid,
    });

class $$LocalRoutesTableFilterComposer
    extends Composer<_$AppDatabase, $LocalRoutesTable> {
  $$LocalRoutesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get routeId => $composableBuilder(
    column: $table.routeId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get theme => $composableBuilder(
    column: $table.theme,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get originJson => $composableBuilder(
    column: $table.originJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get destinationJson => $composableBuilder(
    column: $table.destinationJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get waypointsJson => $composableBuilder(
    column: $table.waypointsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get waypointPlaceIdsJson => $composableBuilder(
    column: $table.waypointPlaceIdsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get optimizedWaypointOrderJson => $composableBuilder(
    column: $table.optimizedWaypointOrderJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalDistanceMeters => $composableBuilder(
    column: $table.totalDistanceMeters,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalDurationSeconds => $composableBuilder(
    column: $table.totalDurationSeconds,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get formattedDistance => $composableBuilder(
    column: $table.formattedDistance,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get formattedDuration => $composableBuilder(
    column: $table.formattedDuration,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get encodedPolyline => $composableBuilder(
    column: $table.encodedPolyline,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get legsJson => $composableBuilder(
    column: $table.legsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isMockData => $composableBuilder(
    column: $table.isMockData,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalRoutesTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalRoutesTable> {
  $$LocalRoutesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get routeId => $composableBuilder(
    column: $table.routeId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get theme => $composableBuilder(
    column: $table.theme,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get originJson => $composableBuilder(
    column: $table.originJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get destinationJson => $composableBuilder(
    column: $table.destinationJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get waypointsJson => $composableBuilder(
    column: $table.waypointsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get waypointPlaceIdsJson => $composableBuilder(
    column: $table.waypointPlaceIdsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get optimizedWaypointOrderJson => $composableBuilder(
    column: $table.optimizedWaypointOrderJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalDistanceMeters => $composableBuilder(
    column: $table.totalDistanceMeters,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalDurationSeconds => $composableBuilder(
    column: $table.totalDurationSeconds,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get formattedDistance => $composableBuilder(
    column: $table.formattedDistance,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get formattedDuration => $composableBuilder(
    column: $table.formattedDuration,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get encodedPolyline => $composableBuilder(
    column: $table.encodedPolyline,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get legsJson => $composableBuilder(
    column: $table.legsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isMockData => $composableBuilder(
    column: $table.isMockData,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalRoutesTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalRoutesTable> {
  $$LocalRoutesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get routeId =>
      $composableBuilder(column: $table.routeId, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => column,
  );

  GeneratedColumn<String> get theme =>
      $composableBuilder(column: $table.theme, builder: (column) => column);

  GeneratedColumn<String> get originJson => $composableBuilder(
    column: $table.originJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get destinationJson => $composableBuilder(
    column: $table.destinationJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get waypointsJson => $composableBuilder(
    column: $table.waypointsJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get waypointPlaceIdsJson => $composableBuilder(
    column: $table.waypointPlaceIdsJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get optimizedWaypointOrderJson => $composableBuilder(
    column: $table.optimizedWaypointOrderJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get totalDistanceMeters => $composableBuilder(
    column: $table.totalDistanceMeters,
    builder: (column) => column,
  );

  GeneratedColumn<int> get totalDurationSeconds => $composableBuilder(
    column: $table.totalDurationSeconds,
    builder: (column) => column,
  );

  GeneratedColumn<String> get formattedDistance => $composableBuilder(
    column: $table.formattedDistance,
    builder: (column) => column,
  );

  GeneratedColumn<String> get formattedDuration => $composableBuilder(
    column: $table.formattedDuration,
    builder: (column) => column,
  );

  GeneratedColumn<String> get encodedPolyline => $composableBuilder(
    column: $table.encodedPolyline,
    builder: (column) => column,
  );

  GeneratedColumn<String> get legsJson =>
      $composableBuilder(column: $table.legsJson, builder: (column) => column);

  GeneratedColumn<bool> get isMockData => $composableBuilder(
    column: $table.isMockData,
    builder: (column) => column,
  );

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$LocalRoutesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalRoutesTable,
          LocalRoute,
          $$LocalRoutesTableFilterComposer,
          $$LocalRoutesTableOrderingComposer,
          $$LocalRoutesTableAnnotationComposer,
          $$LocalRoutesTableCreateCompanionBuilder,
          $$LocalRoutesTableUpdateCompanionBuilder,
          (
            LocalRoute,
            BaseReferences<_$AppDatabase, $LocalRoutesTable, LocalRoute>,
          ),
          LocalRoute,
          PrefetchHooks Function()
        > {
  $$LocalRoutesTableTableManager(_$AppDatabase db, $LocalRoutesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalRoutesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalRoutesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalRoutesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> routeId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> neighborhood = const Value.absent(),
                Value<String> theme = const Value.absent(),
                Value<String> originJson = const Value.absent(),
                Value<String> destinationJson = const Value.absent(),
                Value<String> waypointsJson = const Value.absent(),
                Value<String> waypointPlaceIdsJson = const Value.absent(),
                Value<String> optimizedWaypointOrderJson = const Value.absent(),
                Value<int> totalDistanceMeters = const Value.absent(),
                Value<int> totalDurationSeconds = const Value.absent(),
                Value<String> formattedDistance = const Value.absent(),
                Value<String> formattedDuration = const Value.absent(),
                Value<String> encodedPolyline = const Value.absent(),
                Value<String> legsJson = const Value.absent(),
                Value<bool> isMockData = const Value.absent(),
                Value<String> createdAt = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalRoutesCompanion(
                routeId: routeId,
                title: title,
                neighborhood: neighborhood,
                theme: theme,
                originJson: originJson,
                destinationJson: destinationJson,
                waypointsJson: waypointsJson,
                waypointPlaceIdsJson: waypointPlaceIdsJson,
                optimizedWaypointOrderJson: optimizedWaypointOrderJson,
                totalDistanceMeters: totalDistanceMeters,
                totalDurationSeconds: totalDurationSeconds,
                formattedDistance: formattedDistance,
                formattedDuration: formattedDuration,
                encodedPolyline: encodedPolyline,
                legsJson: legsJson,
                isMockData: isMockData,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String routeId,
                required String title,
                required String neighborhood,
                required String theme,
                required String originJson,
                required String destinationJson,
                required String waypointsJson,
                required String waypointPlaceIdsJson,
                required String optimizedWaypointOrderJson,
                required int totalDistanceMeters,
                required int totalDurationSeconds,
                required String formattedDistance,
                required String formattedDuration,
                required String encodedPolyline,
                required String legsJson,
                Value<bool> isMockData = const Value.absent(),
                required String createdAt,
                required String updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => LocalRoutesCompanion.insert(
                routeId: routeId,
                title: title,
                neighborhood: neighborhood,
                theme: theme,
                originJson: originJson,
                destinationJson: destinationJson,
                waypointsJson: waypointsJson,
                waypointPlaceIdsJson: waypointPlaceIdsJson,
                optimizedWaypointOrderJson: optimizedWaypointOrderJson,
                totalDistanceMeters: totalDistanceMeters,
                totalDurationSeconds: totalDurationSeconds,
                formattedDistance: formattedDistance,
                formattedDuration: formattedDuration,
                encodedPolyline: encodedPolyline,
                legsJson: legsJson,
                isMockData: isMockData,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalRoutesTable, LocalRoute>(table),
                  BaseReferences<_$AppDatabase, $LocalRoutesTable, LocalRoute>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalRoutesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalRoutesTable,
      LocalRoute,
      $$LocalRoutesTableFilterComposer,
      $$LocalRoutesTableOrderingComposer,
      $$LocalRoutesTableAnnotationComposer,
      $$LocalRoutesTableCreateCompanionBuilder,
      $$LocalRoutesTableUpdateCompanionBuilder,
      (
        LocalRoute,
        BaseReferences<_$AppDatabase, $LocalRoutesTable, LocalRoute>,
      ),
      LocalRoute,
      PrefetchHooks Function()
    >;
typedef $$OfflinePacksTableCreateCompanionBuilder =
    OfflinePacksCompanion Function({
      required String packId,
      required String neighborhood,
      required String city,
      required int version,
      required int totalSpotsCount,
      required int totalRoutesCount,
      required int downloadSizeBytes,
      required String sha256Checksum,
      required String downloadedAt,
      Value<bool> isDownloaded,
      Value<int> rowid,
    });
typedef $$OfflinePacksTableUpdateCompanionBuilder =
    OfflinePacksCompanion Function({
      Value<String> packId,
      Value<String> neighborhood,
      Value<String> city,
      Value<int> version,
      Value<int> totalSpotsCount,
      Value<int> totalRoutesCount,
      Value<int> downloadSizeBytes,
      Value<String> sha256Checksum,
      Value<String> downloadedAt,
      Value<bool> isDownloaded,
      Value<int> rowid,
    });

class $$OfflinePacksTableFilterComposer
    extends Composer<_$AppDatabase, $OfflinePacksTable> {
  $$OfflinePacksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get city => $composableBuilder(
    column: $table.city,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalSpotsCount => $composableBuilder(
    column: $table.totalSpotsCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalRoutesCount => $composableBuilder(
    column: $table.totalRoutesCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get downloadSizeBytes => $composableBuilder(
    column: $table.downloadSizeBytes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sha256Checksum => $composableBuilder(
    column: $table.sha256Checksum,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isDownloaded => $composableBuilder(
    column: $table.isDownloaded,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OfflinePacksTableOrderingComposer
    extends Composer<_$AppDatabase, $OfflinePacksTable> {
  $$OfflinePacksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get city => $composableBuilder(
    column: $table.city,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalSpotsCount => $composableBuilder(
    column: $table.totalSpotsCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalRoutesCount => $composableBuilder(
    column: $table.totalRoutesCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get downloadSizeBytes => $composableBuilder(
    column: $table.downloadSizeBytes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sha256Checksum => $composableBuilder(
    column: $table.sha256Checksum,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isDownloaded => $composableBuilder(
    column: $table.isDownloaded,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OfflinePacksTableAnnotationComposer
    extends Composer<_$AppDatabase, $OfflinePacksTable> {
  $$OfflinePacksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get neighborhood => $composableBuilder(
    column: $table.neighborhood,
    builder: (column) => column,
  );

  GeneratedColumn<String> get city =>
      $composableBuilder(column: $table.city, builder: (column) => column);

  GeneratedColumn<int> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<int> get totalSpotsCount => $composableBuilder(
    column: $table.totalSpotsCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get totalRoutesCount => $composableBuilder(
    column: $table.totalRoutesCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get downloadSizeBytes => $composableBuilder(
    column: $table.downloadSizeBytes,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sha256Checksum => $composableBuilder(
    column: $table.sha256Checksum,
    builder: (column) => column,
  );

  GeneratedColumn<String> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isDownloaded => $composableBuilder(
    column: $table.isDownloaded,
    builder: (column) => column,
  );
}

class $$OfflinePacksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OfflinePacksTable,
          OfflinePack,
          $$OfflinePacksTableFilterComposer,
          $$OfflinePacksTableOrderingComposer,
          $$OfflinePacksTableAnnotationComposer,
          $$OfflinePacksTableCreateCompanionBuilder,
          $$OfflinePacksTableUpdateCompanionBuilder,
          (
            OfflinePack,
            BaseReferences<_$AppDatabase, $OfflinePacksTable, OfflinePack>,
          ),
          OfflinePack,
          PrefetchHooks Function()
        > {
  $$OfflinePacksTableTableManager(_$AppDatabase db, $OfflinePacksTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflinePacksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflinePacksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflinePacksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> packId = const Value.absent(),
                Value<String> neighborhood = const Value.absent(),
                Value<String> city = const Value.absent(),
                Value<int> version = const Value.absent(),
                Value<int> totalSpotsCount = const Value.absent(),
                Value<int> totalRoutesCount = const Value.absent(),
                Value<int> downloadSizeBytes = const Value.absent(),
                Value<String> sha256Checksum = const Value.absent(),
                Value<String> downloadedAt = const Value.absent(),
                Value<bool> isDownloaded = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflinePacksCompanion(
                packId: packId,
                neighborhood: neighborhood,
                city: city,
                version: version,
                totalSpotsCount: totalSpotsCount,
                totalRoutesCount: totalRoutesCount,
                downloadSizeBytes: downloadSizeBytes,
                sha256Checksum: sha256Checksum,
                downloadedAt: downloadedAt,
                isDownloaded: isDownloaded,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String packId,
                required String neighborhood,
                required String city,
                required int version,
                required int totalSpotsCount,
                required int totalRoutesCount,
                required int downloadSizeBytes,
                required String sha256Checksum,
                required String downloadedAt,
                Value<bool> isDownloaded = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflinePacksCompanion.insert(
                packId: packId,
                neighborhood: neighborhood,
                city: city,
                version: version,
                totalSpotsCount: totalSpotsCount,
                totalRoutesCount: totalRoutesCount,
                downloadSizeBytes: downloadSizeBytes,
                sha256Checksum: sha256Checksum,
                downloadedAt: downloadedAt,
                isDownloaded: isDownloaded,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OfflinePacksTable, OfflinePack>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $OfflinePacksTable,
                    OfflinePack
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OfflinePacksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OfflinePacksTable,
      OfflinePack,
      $$OfflinePacksTableFilterComposer,
      $$OfflinePacksTableOrderingComposer,
      $$OfflinePacksTableAnnotationComposer,
      $$OfflinePacksTableCreateCompanionBuilder,
      $$OfflinePacksTableUpdateCompanionBuilder,
      (
        OfflinePack,
        BaseReferences<_$AppDatabase, $OfflinePacksTable, OfflinePack>,
      ),
      OfflinePack,
      PrefetchHooks Function()
    >;
typedef $$PackSpotsTableCreateCompanionBuilder = PackSpotsCompanion Function({
  required String packId,
  required String spotId,
  Value<int> rowid,
});
typedef $$PackSpotsTableUpdateCompanionBuilder = PackSpotsCompanion Function({
  Value<String> packId,
  Value<String> spotId,
  Value<int> rowid,
});

class $$PackSpotsTableFilterComposer
    extends Composer<_$AppDatabase, $PackSpotsTable> {
  $$PackSpotsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get spotId => $composableBuilder(
    column: $table.spotId,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PackSpotsTableOrderingComposer
    extends Composer<_$AppDatabase, $PackSpotsTable> {
  $$PackSpotsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get spotId => $composableBuilder(
    column: $table.spotId,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PackSpotsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PackSpotsTable> {
  $$PackSpotsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get spotId =>
      $composableBuilder(column: $table.spotId, builder: (column) => column);
}

class $$PackSpotsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PackSpotsTable,
          PackSpot,
          $$PackSpotsTableFilterComposer,
          $$PackSpotsTableOrderingComposer,
          $$PackSpotsTableAnnotationComposer,
          $$PackSpotsTableCreateCompanionBuilder,
          $$PackSpotsTableUpdateCompanionBuilder,
          (PackSpot, BaseReferences<_$AppDatabase, $PackSpotsTable, PackSpot>),
          PackSpot,
          PrefetchHooks Function()
        > {
  $$PackSpotsTableTableManager(_$AppDatabase db, $PackSpotsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PackSpotsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PackSpotsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PackSpotsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> packId = const Value.absent(),
                Value<String> spotId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PackSpotsCompanion(
                packId: packId,
                spotId: spotId,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String packId,
                required String spotId,
                Value<int> rowid = const Value.absent(),
              }) => PackSpotsCompanion.insert(
                packId: packId,
                spotId: spotId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PackSpotsTable, PackSpot>(table),
                  BaseReferences<_$AppDatabase, $PackSpotsTable, PackSpot>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PackSpotsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PackSpotsTable,
      PackSpot,
      $$PackSpotsTableFilterComposer,
      $$PackSpotsTableOrderingComposer,
      $$PackSpotsTableAnnotationComposer,
      $$PackSpotsTableCreateCompanionBuilder,
      $$PackSpotsTableUpdateCompanionBuilder,
      (PackSpot, BaseReferences<_$AppDatabase, $PackSpotsTable, PackSpot>),
      PackSpot,
      PrefetchHooks Function()
    >;
typedef $$PackRoutesTableCreateCompanionBuilder = PackRoutesCompanion Function({
  required String packId,
  required String routeId,
  Value<int> rowid,
});
typedef $$PackRoutesTableUpdateCompanionBuilder = PackRoutesCompanion Function({
  Value<String> packId,
  Value<String> routeId,
  Value<int> rowid,
});

class $$PackRoutesTableFilterComposer
    extends Composer<_$AppDatabase, $PackRoutesTable> {
  $$PackRoutesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get routeId => $composableBuilder(
    column: $table.routeId,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PackRoutesTableOrderingComposer
    extends Composer<_$AppDatabase, $PackRoutesTable> {
  $$PackRoutesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get routeId => $composableBuilder(
    column: $table.routeId,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PackRoutesTableAnnotationComposer
    extends Composer<_$AppDatabase, $PackRoutesTable> {
  $$PackRoutesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get routeId =>
      $composableBuilder(column: $table.routeId, builder: (column) => column);
}

class $$PackRoutesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PackRoutesTable,
          PackRoute,
          $$PackRoutesTableFilterComposer,
          $$PackRoutesTableOrderingComposer,
          $$PackRoutesTableAnnotationComposer,
          $$PackRoutesTableCreateCompanionBuilder,
          $$PackRoutesTableUpdateCompanionBuilder,
          (
            PackRoute,
            BaseReferences<_$AppDatabase, $PackRoutesTable, PackRoute>,
          ),
          PackRoute,
          PrefetchHooks Function()
        > {
  $$PackRoutesTableTableManager(_$AppDatabase db, $PackRoutesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PackRoutesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PackRoutesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PackRoutesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> packId = const Value.absent(),
                Value<String> routeId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PackRoutesCompanion(
                packId: packId,
                routeId: routeId,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String packId,
                required String routeId,
                Value<int> rowid = const Value.absent(),
              }) => PackRoutesCompanion.insert(
                packId: packId,
                routeId: routeId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PackRoutesTable, PackRoute>(table),
                  BaseReferences<_$AppDatabase, $PackRoutesTable, PackRoute>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PackRoutesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PackRoutesTable,
      PackRoute,
      $$PackRoutesTableFilterComposer,
      $$PackRoutesTableOrderingComposer,
      $$PackRoutesTableAnnotationComposer,
      $$PackRoutesTableCreateCompanionBuilder,
      $$PackRoutesTableUpdateCompanionBuilder,
      (PackRoute, BaseReferences<_$AppDatabase, $PackRoutesTable, PackRoute>),
      PackRoute,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$LocalSpotsTableTableManager get localSpots =>
      $$LocalSpotsTableTableManager(_db, _db.localSpots);
  $$LocalRoutesTableTableManager get localRoutes =>
      $$LocalRoutesTableTableManager(_db, _db.localRoutes);
  $$OfflinePacksTableTableManager get offlinePacks =>
      $$OfflinePacksTableTableManager(_db, _db.offlinePacks);
  $$PackSpotsTableTableManager get packSpots =>
      $$PackSpotsTableTableManager(_db, _db.packSpots);
  $$PackRoutesTableTableManager get packRoutes =>
      $$PackRoutesTableTableManager(_db, _db.packRoutes);
}
