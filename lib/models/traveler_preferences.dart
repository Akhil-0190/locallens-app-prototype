// Canonical Domain 02: Traveler Preferences
// Reference: docs/contracts/02-traveler-preferences.md

enum BudgetTier {
  budget,
  moderate,
  premium;

  String get value {
    switch (this) {
      case BudgetTier.budget:
        return 'BUDGET';
      case BudgetTier.moderate:
        return 'MODERATE';
      case BudgetTier.premium:
        return 'PREMIUM';
    }
  }

  String get displayName {
    switch (this) {
      case BudgetTier.budget:
        return 'Budget (Pocket Friendly)';
      case BudgetTier.moderate:
        return 'Moderate (Standard)';
      case BudgetTier.premium:
        return 'Premium (Heritage Splurge)';
    }
  }

  static BudgetTier fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'BUDGET':
        return BudgetTier.budget;
      case 'PREMIUM':
        return BudgetTier.premium;
      case 'MODERATE':
      default:
        return BudgetTier.moderate;
    }
  }
}

enum TravelPacing {
  relaxed,
  balanced,
  packed;

  String get value {
    switch (this) {
      case TravelPacing.relaxed:
        return 'RELAXED';
      case TravelPacing.balanced:
        return 'BALANCED';
      case TravelPacing.packed:
        return 'PACKED';
    }
  }

  String get displayName {
    switch (this) {
      case TravelPacing.relaxed:
        return 'Relaxed Walk';
      case TravelPacing.balanced:
        return 'Balanced Pace';
      case TravelPacing.packed:
        return 'Action Packed';
    }
  }

  static TravelPacing fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'RELAXED':
        return TravelPacing.relaxed;
      case 'PACKED':
        return TravelPacing.packed;
      case 'BALANCED':
      default:
        return TravelPacing.balanced;
    }
  }
}

class TravelerPreferencesDocument {
  final String userId;
  final List<String> favoriteVibes;
  final List<String> dietaryRestrictions;
  final BudgetTier budgetTier;
  final int maxBudgetPerMealInr;
  final TravelPacing preferredPacing;
  final List<String> preferredNeighborhoods;
  final List<String> accessibilityNeeds;
  final DateTime updatedAt;

  const TravelerPreferencesDocument({
    required this.userId,
    this.favoriteVibes = const [
      'heritage',
      'vintage_filter_coffee',
      'street_food',
    ],
    this.dietaryRestrictions = const ['vegetarian'],
    this.budgetTier = BudgetTier.moderate,
    this.maxBudgetPerMealInr = 250,
    this.preferredPacing = TravelPacing.balanced,
    this.preferredNeighborhoods = const ['Malleshwaram', 'Basavanagudi'],
    this.accessibilityNeeds = const [],
    required this.updatedAt,
  });

  // Contract constants per Domain 02
  static const List<String> supportedVibes = [
    'heritage',
    'vintage_filter_coffee',
    'street_food',
    'quiet_courtyard',
    'artisanal_crafts',
    'generational_recipes',
    'pocket_friendly',
  ];

  static const List<String> supportedDietaryRestrictions = [
    'vegetarian',
    'vegan',
    'halal',
    'jain',
    'gluten_free',
    'nut_allergy',
  ];

  static const List<String> supportedNeighborhoods = [
    'Malleshwaram',
    'Basavanagudi',
    'Indiranagar',
  ];

  static const List<String> supportedAccessibilityNeeds = [
    'wheelchair_accessible',
    'step_free',
    'audio_descriptions',
  ];

  static String vibeDisplayName(String vibe) {
    switch (vibe) {
      case 'heritage':
        return 'Heritage & History';
      case 'vintage_filter_coffee':
        return 'Traditional Filter Coffee';
      case 'street_food':
        return 'Authentic Street Food';
      case 'quiet_courtyard':
        return 'Quiet Courtyards';
      case 'artisanal_crafts':
        return 'Local Artisanal Crafts';
      case 'generational_recipes':
        return 'Generational Recipes';
      case 'pocket_friendly':
        return 'Pocket Friendly';
      default:
        return vibe.replaceAll('_', ' ');
    }
  }

  static String dietaryDisplayName(String diet) {
    switch (diet) {
      case 'vegetarian':
        return 'Pure Vegetarian';
      case 'vegan':
        return 'Vegan';
      case 'halal':
        return 'Halal';
      case 'jain':
        return 'Jain (No Root Veg)';
      case 'gluten_free':
        return 'Gluten-Free';
      case 'nut_allergy':
        return 'Nut Allergy';
      default:
        return diet.replaceAll('_', ' ');
    }
  }

  static String accessibilityDisplayName(String need) {
    switch (need) {
      case 'wheelchair_accessible':
        return 'Wheelchair Accessible';
      case 'step_free':
        return 'Step-Free Entry';
      case 'audio_descriptions':
        return 'Audio Descriptions';
      default:
        return need.replaceAll('_', ' ');
    }
  }

  TravelerPreferencesDocument copyWith({
    String? userId,
    List<String>? favoriteVibes,
    List<String>? dietaryRestrictions,
    BudgetTier? budgetTier,
    int? maxBudgetPerMealInr,
    TravelPacing? preferredPacing,
    List<String>? preferredNeighborhoods,
    List<String>? accessibilityNeeds,
    DateTime? updatedAt,
  }) {
    return TravelerPreferencesDocument(
      userId: userId ?? this.userId,
      favoriteVibes: favoriteVibes ?? this.favoriteVibes,
      dietaryRestrictions: dietaryRestrictions ?? this.dietaryRestrictions,
      budgetTier: budgetTier ?? this.budgetTier,
      maxBudgetPerMealInr: maxBudgetPerMealInr ?? this.maxBudgetPerMealInr,
      preferredPacing: preferredPacing ?? this.preferredPacing,
      preferredNeighborhoods: preferredNeighborhoods ?? this.preferredNeighborhoods,
      accessibilityNeeds: accessibilityNeeds ?? this.accessibilityNeeds,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'favoriteVibes': favoriteVibes,
      'dietaryRestrictions': dietaryRestrictions,
      'budgetTier': budgetTier.value,
      'maxBudgetPerMealInr': maxBudgetPerMealInr,
      'preferredPacing': preferredPacing.value,
      'preferredNeighborhoods': preferredNeighborhoods,
      'accessibilityNeeds': accessibilityNeeds,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory TravelerPreferencesDocument.fromMap(Map<String, dynamic> map) {
    return TravelerPreferencesDocument(
      userId: map['userId'] ?? 'usr_guest_traveler',
      favoriteVibes: List<String>.from(map['favoriteVibes'] ?? []),
      dietaryRestrictions: List<String>.from(map['dietaryRestrictions'] ?? []),
      budgetTier: BudgetTier.fromString(map['budgetTier']),
      maxBudgetPerMealInr: (map['maxBudgetPerMealInr'] as num?)?.toInt() ?? 250,
      preferredPacing: TravelPacing.fromString(map['preferredPacing']),
      preferredNeighborhoods: List<String>.from(map['preferredNeighborhoods'] ?? []),
      accessibilityNeeds: List<String>.from(map['accessibilityNeeds'] ?? []),
      updatedAt: DateTime.tryParse(map['updatedAt'] ?? '') ?? DateTime.now(),
    );
  }
}
