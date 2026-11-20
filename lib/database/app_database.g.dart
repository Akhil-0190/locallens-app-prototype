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
          ..write('vibeTagsJson: $vibeTagsJson')
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
          other.vibeTagsJson == this.vibeTagsJson);
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
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $LocalSpotsTable localSpots = $LocalSpotsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [localSpots];
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

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$LocalSpotsTableTableManager get localSpots =>
      $$LocalSpotsTableTableManager(_db, _db.localSpots);
}
