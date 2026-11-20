# Domain 10: Offline Neighborhood Packs

**Contract Reference:** `docs/contracts/10-offline-neighborhood-packs.md`
**Firestore Collection:** `offline_packs/{packId}`
**Primary Stakeholders:** Developer A (Backend Pack Generator), Developer D (Flutter SQLite Drift Sync)
**Sample Payload:** [docs/contracts/samples/10-offline-pack-manifest.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/10-offline-pack-manifest.sample.json)

---

## 1. Scope & Ownership
Provides pre-bundled offline packs enabling 100% offline pedestrian navigation and spot exploration. Directly populates Developer D's client Drift database (`locallens_offline.sqlite`).

---

## 2. Canonical TypeScript Interface

```typescript
import { CanonicalRouteDocument } from './08-routes-and-route-stops';

export interface OfflineSpotItem {
  id: string;
  spotName: string;
  mapsLink: string;
  infoParagraph: string;
  photoUrlsJson: string;                // Stringified JSON array of image URLs
  openHours: string;
  practicalTips: string;
  greetingCard: string;
  isTouristTrap: boolean;
  hourlyLimit: number;
  currentVisitors: number;
  vibeTagsJson: string;                 // Stringified JSON array of vibe tags
  latitude: number;
  longitude: number;
}

export interface OfflinePackManifestDocument {
  packId: string;                       // e.g. "pack_malleshwaram_v1"
  neighborhood: string;                 // e.g. "Malleshwaram"
  city: string;                         // e.g. "Bengaluru"
  version: number;                      // Incremental revision integer
  totalSpotsCount: number;
  totalRoutesCount: number;
  downloadSizeBytes: number;
  downloadUrl: string;                  // Firebase Storage bundle URL
  sha256Checksum: string;               // File integrity verification
  spots: OfflineSpotItem[];             // Directly maps to Drift LocalSpots table
  routes: CanonicalRouteDocument[];     // Walking routes with encoded polylines
  publishedAt: string;                  // ISO 8601 UTC
}
```

---

## 3. Drift Synchronization Contract
Matches `LocalSpots` SQLite schema in `lib/database/app_database.dart`:
```dart
into(localSpots).insertOnConflictUpdate(
  LocalSpotsCompanion.insert(
    id: spot.id,
    spotName: spot.spotName,
    mapsLink: spot.mapsLink,
    infoParagraph: spot.infoParagraph,
    photoUrlsJson: spot.photoUrlsJson,
    openHours: Value(spot.openHours),
    practicalTips: Value(spot.practicalTips),
    greetingCard: Value(spot.greetingCard),
    isTouristTrap: Value(spot.isTouristTrap),
    hourlyLimit: Value(spot.hourlyLimit),
    currentVisitors: Value(spot.currentVisitors),
    vibeTagsJson: spot.vibeTagsJson,
  ),
);
```
