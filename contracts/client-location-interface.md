# Client Location Permission & Interface Requirements

**Target:** Developer D (Flutter Client Engineer)  
**Author:** Developer C (Maps Platform & Routing Engine)  
**Task Reference:** C1 — Google Maps Platform Foundation  
**Status:** SPECIFIED FOR CLIENT IMPLEMENTATION  

---

## 1. Overview

LocalLens requires location access to support three key operational modes:
1. **Interactive Discovery:** Showing the traveler's position relative to recommended neighborhood gems on the map.
2. **Pedestrian Turn-by-Turn Guidance:** Triggering earphone audio walking prompts as the traveler approaches key street corners or alley turns.
3. **Crowd Check-In / Proximity Verification:** Verifying traveler proximity to authentic local venues without invasive persistent background tracking.

---

## 2. Location Permissions Matrix (Android & iOS)

### A. Android Configuration (`AndroidManifest.xml`)
Developer D must configure the following permission entries in `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Foreground location access for map centering and nearby gems -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Optional foreground service for active walking audio co-pilot navigation -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

### B. iOS Configuration (`Info.plist`)
Developer D must add user-facing justification strings in `ios/Runner/Info.plist`:
- `NSLocationWhenInUseUsageDescription`: "LocalLens uses your location to guide you along authentic neighborhood walking routes and show nearby local gems."
- `NSLocationAlwaysAndWhenInUseUsageDescription`: "LocalLens uses your location during active walking mode to provide hands-free audio walking prompts."

---

## 3. Location State Interface Model (Dart / Flutter)

Developer D should adopt the following interface model in `lib/models/user_location.dart`:

```dart
class UserLocation {
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final double? altitude;
  final double? headingDegrees;
  final double? speedMps;
  final DateTime timestamp;
  final bool isMockLocation;

  const UserLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    this.altitude,
    this.headingDegrees,
    this.speedMps,
    required this.timestamp,
    this.isMockLocation = false,
  });

  /// Validates whether the fix is sufficiently accurate for pedestrian navigation (< 25m)
  bool get isReliableForWalking => accuracyMeters <= 25.0;

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
    'accuracyMeters': accuracyMeters,
    'headingDegrees': headingDegrees,
    'speedMps': speedMps,
    'timestamp': timestamp.toIso8601String(),
    'isMockLocation': isMockLocation,
  };
}
```

---

## 4. Privacy, Battery & Offline Guidelines

1. **Adaptive Geolocation Frequency:**
   - **Idle/Browsing Mode:** Query location only on user request or map movement (battery-friendly).
   - **Active Walk Mode:** Poll at 5-10 second intervals or 10-meter distance filters.
2. **Graceful Permission Degradation:**
   - If the traveler denies location permission, prompt them to pick their starting neighborhood center (e.g. "Malleshwaram 8th Cross" or "Basavanagudi") manually from a dropdown list rather than blocking the application.
3. **No Key Hardcoding in Flutter:**
   - Provide the Google Maps API key via Android manifest placeholders using `local.properties` or environment variables (`--dart-define=MAPS_API_KEY=...`).
