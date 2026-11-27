import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../config/app_config.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';

class GroupMemberSummary {
  final String userId;
  final String displayName;
  final List<String> vibes;
  final List<String> dietaryRestrictions;
  final int maxBudgetAmount;

  const GroupMemberSummary({
    required this.userId,
    required this.displayName,
    this.vibes = const [],
    this.dietaryRestrictions = const [],
    this.maxBudgetAmount = 500,
  });

  factory GroupMemberSummary.fromMap(Map<String, dynamic> map) {
    return GroupMemberSummary(
      userId: (map['userId'] ?? '').toString(),
      displayName: (map['displayName'] ?? 'Traveler').toString(),
      vibes: List<String>.from(map['vibes'] ?? const []),
      dietaryRestrictions: List<String>.from(map['dietaryRestrictions'] ?? const []),
      maxBudgetAmount: (map['maxBudgetAmount'] as num?)?.toInt() ?? 500,
    );
  }
}

class GroupSessionModel {
  final String sessionId;
  final String sessionCode;
  final String hostUserId;
  final String neighborhood;
  final List<GroupMemberSummary> members;
  final String status;

  const GroupSessionModel({
    required this.sessionId,
    required this.sessionCode,
    required this.hostUserId,
    required this.neighborhood,
    this.members = const [],
    this.status = 'ACTIVE',
  });

  factory GroupSessionModel.fromMap(Map<String, dynamic> map) {
    final rawMembers = map['members'] as List? ?? const [];
    return GroupSessionModel(
      sessionId: (map['sessionId'] ?? '').toString(),
      sessionCode: (map['sessionCode'] ?? '').toString(),
      hostUserId: (map['hostUserId'] ?? '').toString(),
      neighborhood: (map['neighborhood'] ?? 'Malleshwaram').toString(),
      members: rawMembers
          .whereType<Map>()
          .map((m) => GroupMemberSummary.fromMap(Map<String, dynamic>.from(m)))
          .toList(),
      status: (map['status'] ?? 'ACTIVE').toString(),
    );
  }
}

class WeatherContextModel {
  final String condition;
  final bool isWalkingImpaired;
  final double temperatureCelsius;
  final String? advisory;

  const WeatherContextModel({
    required this.condition,
    required this.isWalkingImpaired,
    required this.temperatureCelsius,
    this.advisory,
  });

  factory WeatherContextModel.fromMap(Map<String, dynamic> map) {
    return WeatherContextModel(
      condition: (map['condition'] ?? 'UNAVAILABLE').toString(),
      isWalkingImpaired: map['isWalkingImpaired'] == true,
      temperatureCelsius: (map['temperatureCelsius'] as num?)?.toDouble() ?? 0.0,
      advisory: map['advisory'] as String?,
    );
  }
}

class GroupBlendSummaryModel {
  final String sessionId;
  final String sessionCode;
  final int memberCount;
  final int groupCohesionScore;
  final String blendedVibeSummary;
  final List<String> dietaryUnion;
  final List<String> conflictWarnings;

  const GroupBlendSummaryModel({
    required this.sessionId,
    required this.sessionCode,
    required this.memberCount,
    required this.groupCohesionScore,
    required this.blendedVibeSummary,
    this.dietaryUnion = const [],
    this.conflictWarnings = const [],
  });
}

class DiscoveryMatchResult {
  final List<SpotCard> spots;
  final WeatherContextModel? weather;
  final GroupBlendSummaryModel? groupBlend;
  final String slotId;
  final String modelUsed;

  const DiscoveryMatchResult({
    required this.spots,
    this.weather,
    this.groupBlend,
    required this.slotId,
    required this.modelUsed,
  });
}

class BookedVisitModel {
  final String visitId;
  final String placeId;
  final String slotId;
  final int partySize;
  final String status;

  const BookedVisitModel({
    required this.visitId,
    required this.placeId,
    required this.slotId,
    required this.partySize,
    required this.status,
  });

  factory BookedVisitModel.fromMap(Map<String, dynamic> map) {
    return BookedVisitModel(
      visitId: (map['visitId'] ?? '').toString(),
      placeId: (map['placeId'] ?? '').toString(),
      slotId: (map['slotId'] ?? '').toString(),
      partySize: (map['partySize'] as num?)?.toInt() ?? 1,
      status: (map['status'] ?? 'CONFIRMED').toString(),
    );
  }
}

/// Live Firebase Cloud Functions + Firestore gateway for Stage 2:
/// Preferences, Multi-User Group Sessions, Real-Time Hourly Venue Crowd Caps,
/// and Gemini Embedding 2 Solo/Group Discovery Matchmaking.
class GroupCapacityService {
  final FirebaseFunctions? _functionsOverride;
  final FirebaseFirestore? _firestoreOverride;
  final FirebaseAuth? _authOverride;

  GroupCapacityService({
    FirebaseFunctions? functions,
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _functionsOverride = functions,
        _firestoreOverride = firestore,
        _authOverride = auth;

  FirebaseFunctions get _functions =>
      _functionsOverride ?? FirebaseFunctions.instanceFor(region: AppConfig.apiRegion);

  FirebaseFirestore get _firestore => _firestoreOverride ?? FirebaseFirestore.instance;

  String? get _currentUid {
    try {
      return (_authOverride ?? FirebaseAuth.instance).currentUser?.uid;
    } catch (_) {
      return null;
    }
  }

  /// Derives canonical UTC top-of-hour slot ID (`slot_YYYYMMDD_HH00`) matching A4 backend contract.
  static String deriveSlotId({DateTime? forTime}) {
    final dt = (forTime ?? DateTime.now().add(const Duration(hours: 1))).toUtc();
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    return 'slot_$y$m${d}_${h}00';
  }

  // ---------------------------------------------------------------------------
  // Domain 02: Preferences CRUD
  // ---------------------------------------------------------------------------

  Future<TravelerPreferencesDocument?> fetchPreferences() async {
    final callable = _functions.httpsCallable('Preferences-getPreferences');
    final res = await callable.call<Map<String, dynamic>>({});
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    if (data.isEmpty) return null;
    return TravelerPreferencesDocument.fromMap(data);
  }

  Future<TravelerPreferencesDocument> savePreferences(
    TravelerPreferencesDocument prefs,
  ) async {
    final callable = _functions.httpsCallable('Preferences-updatePreferences');
    final res = await callable.call<Map<String, dynamic>>(prefs.toMap());
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return data.isNotEmpty ? TravelerPreferencesDocument.fromMap(data) : prefs;
  }

  // ---------------------------------------------------------------------------
  // Domain 09: Group Sessions CRUD & Live Stream
  // ---------------------------------------------------------------------------

  Future<GroupSessionModel> createGroupSession({
    required String neighborhood,
    required TravelerPreferencesDocument preferences,
    String? displayName,
  }) async {
    final callable = _functions.httpsCallable('Groups-createGroupSession');
    final res = await callable.call<Map<String, dynamic>>({
      'neighborhood': neighborhood,
      'displayName': displayName ?? 'Host Explorer',
      'vibes': preferences.favoriteVibes,
      'dietaryRestrictions': preferences.dietaryRestrictions,
      'maxBudgetAmount': preferences.maxBudgetPerMealInr,
      'weighting': 1.0,
    });
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return GroupSessionModel.fromMap(data);
  }

  Future<GroupSessionModel> joinGroupSession({
    required String sessionCode,
    required TravelerPreferencesDocument preferences,
    String? displayName,
  }) async {
    final callable = _functions.httpsCallable('Groups-joinGroupSession');
    final res = await callable.call<Map<String, dynamic>>({
      'sessionCode': sessionCode.trim().toUpperCase(),
      'displayName': displayName ?? 'Squad Traveler',
      'vibes': preferences.favoriteVibes,
      'dietaryRestrictions': preferences.dietaryRestrictions,
      'maxBudgetAmount': preferences.maxBudgetPerMealInr,
      'weighting': 1.0,
    });
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return GroupSessionModel.fromMap(data);
  }

  Future<void> leaveGroupSession(String sessionId) async {
    final callable = _functions.httpsCallable('Groups-leaveGroupSession');
    await callable.call<Map<String, dynamic>>({'sessionId': sessionId});
  }

  Stream<GroupSessionModel?> watchGroupSession(String sessionId) {
    return _firestore
        .collection('group_sessions')
        .doc(sessionId)
        .snapshots()
        .map((snap) => snap.exists && snap.data() != null
            ? GroupSessionModel.fromMap(snap.data()!)
            : null);
  }

  // ---------------------------------------------------------------------------
  // Stage 2: Gemini Embedding 2 Solo & Group Vector Discovery
  // ---------------------------------------------------------------------------

  Future<DiscoveryMatchResult> matchSoloSpots({
    required TravelerPreferencesDocument preferences,
    String? neighborhood,
    String? queryText,
    int partySize = 1,
  }) async {
    final callable = _functions.httpsCallable('Discovery-matchSoloSpots');
    final res = await callable.call<Map<String, dynamic>>({
      'neighborhood': ?neighborhood,
      'queryText': ?queryText,
      'vibes': preferences.favoriteVibes,
      'dietaryRestrictions': preferences.dietaryRestrictions,
      'maxBudgetPerMealInr': preferences.maxBudgetPerMealInr,
      'intendedVisitTimeIso': DateTime.now().toUtc().toIso8601String(),
      'partySize': partySize,
    });

    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    final rawSpots = data['spots'] as List? ?? const [];
    final spots = rawSpots.whereType<Map>().map((entry) {
      final entryMap = Map<String, dynamic>.from(entry);
      final spotMap = Map<String, dynamic>.from(entryMap['spot'] as Map? ?? {});
      final id = (spotMap['id'] ?? spotMap['placeId'] ?? '').toString();
      return SpotCard.fromMap(id, spotMap);
    }).toList();

    final weatherMap = data['weatherContext'] is Map
        ? Map<String, dynamic>.from(data['weatherContext'] as Map)
        : null;

    return DiscoveryMatchResult(
      spots: spots,
      weather: weatherMap != null ? WeatherContextModel.fromMap(weatherMap) : null,
      slotId: (data['slotId'] ?? deriveSlotId()).toString(),
      modelUsed: (data['modelUsed'] ?? 'gemini-embedding-2').toString(),
    );
  }

  Future<DiscoveryMatchResult> matchGroupSpots({
    required String sessionId,
    String? neighborhood,
  }) async {
    final callable = _functions.httpsCallable('Discovery-matchGroupSpots');
    final res = await callable.call<Map<String, dynamic>>({
      'sessionId': sessionId,
      'neighborhood': ?neighborhood,
      'intendedVisitTimeIso': DateTime.now().toUtc().toIso8601String(),
    });

    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    final rawSpots = data['spots'] as List? ?? const [];
    final spots = rawSpots.whereType<Map>().map((entry) {
      final entryMap = Map<String, dynamic>.from(entry);
      final spotMap = Map<String, dynamic>.from(entryMap['spot'] as Map? ?? {});
      final id = (spotMap['id'] ?? spotMap['placeId'] ?? '').toString();
      return SpotCard.fromMap(id, spotMap);
    }).toList();

    final weatherMap = data['weatherContext'] is Map
        ? Map<String, dynamic>.from(data['weatherContext'] as Map)
        : null;

    final groupBlend = GroupBlendSummaryModel(
      sessionId: (data['sessionId'] ?? sessionId).toString(),
      sessionCode: (data['sessionCode'] ?? '').toString(),
      memberCount: (data['memberCount'] as num?)?.toInt() ?? 1,
      groupCohesionScore: (data['groupCohesionScore'] as num?)?.toInt() ?? 85,
      blendedVibeSummary: (data['blendedVibeSummary'] ?? '').toString(),
      dietaryUnion: List<String>.from(data['dietaryUnion'] ?? const []),
      conflictWarnings: List<String>.from(data['conflictWarnings'] ?? const []),
    );

    return DiscoveryMatchResult(
      spots: spots,
      weather: weatherMap != null ? WeatherContextModel.fromMap(weatherMap) : null,
      groupBlend: groupBlend,
      slotId: (data['slotId'] ?? deriveSlotId()).toString(),
      modelUsed: 'gemini-embedding-2',
    );
  }

  // ---------------------------------------------------------------------------
  // Domain 07: Real-Time Hourly Venue Crowd Caps (Transactional Booking / Check-in / Cancel)
  // ---------------------------------------------------------------------------

  Future<BookedVisitModel> bookHourlySlot({
    required String placeId,
    String? slotId,
    int partySize = 1,
    String? groupSessionId,
    List<String>? memberUserIds,
  }) async {
    final effectiveSlotId = slotId ?? deriveSlotId();
    final uid = _currentUid ?? 'traveler';
    final effectiveMembers = (memberUserIds != null && memberUserIds.length == partySize)
        ? memberUserIds
        : List<String>.generate(
            partySize,
            (i) => i == 0 ? uid : '${uid}_guest_$i',
          );
    final idempotencyKey = 'book_${uid}_${placeId}_$effectiveSlotId';

    final callable = _functions.httpsCallable('Capacity-bookScheduledVisit');
    final res = await callable.call<Map<String, dynamic>>({
      'placeId': placeId,
      'slotId': effectiveSlotId,
      'partySize': partySize,
      'idempotencyKey': idempotencyKey,
      'groupSessionId': ?groupSessionId,
      'memberUserIds': effectiveMembers,
    });
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return BookedVisitModel.fromMap(data);
  }

  Future<BookedVisitModel> cancelHourlySlot(String visitId) async {
    final callable = _functions.httpsCallable('Capacity-cancelScheduledVisit');
    final res = await callable.call<Map<String, dynamic>>({'visitId': visitId});
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return BookedVisitModel.fromMap(data);
  }

  Future<BookedVisitModel> checkInHourlySlot({
    required String visitId,
    double? latitude,
    double? longitude,
  }) async {
    final callable = _functions.httpsCallable('Capacity-checkInScheduledVisit');
    final res = await callable.call<Map<String, dynamic>>({
      'visitId': visitId,
      if (latitude != null && longitude != null)
        'travelerCoordinate': {'latitude': latitude, 'longitude': longitude},
    });
    final data = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
    return BookedVisitModel.fromMap(data);
  }
}
