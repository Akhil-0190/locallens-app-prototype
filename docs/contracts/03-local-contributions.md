# Domain 03: Local Contributions

**Contract Reference:** `docs/contracts/03-local-contributions.md`
**Firestore Collection:** `contributions/{contributionId}`
**Primary Stakeholders:** Developer A (Backend Pipeline), Developer B (AI Extraction), Developer C (Maps Grounding), Developer D (Flutter Add Gem Screen)
**Sample Payload:** [docs/contracts/samples/03-local-contribution.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/03-local-contribution.sample.json)

---

## 1. Scope & Ownership
Tracks community spot submissions from initial traveler upload in Flutter to AI analysis, Maps grounding, and final publication in `places`.

---

## 2. Canonical TypeScript Interface

```typescript
export type ContributionStatus =
  | 'SUBMITTED'
  | 'AI_ANALYZED'
  | 'MAPS_GROUNDED'
  | 'VERIFIED'
  | 'REJECTED';

export interface ContributorSubmissionInput {
  mapsLink: string;                     // Direct Google Maps URL provided by contributor
  infoParagraph: string;                // Contributor's 3-4 line narrative story
  photoUrls: string[];                  // Uploaded street photos in Cloud Storage
  audioNoteUrl?: string;                // Optional voice recording in regional language
  contributorId: string;                // Firebase Auth UID
}

export interface ContributionDocument {
  contributionId: string;               // Unique contribution UUID
  submission: ContributorSubmissionInput;
  status: ContributionStatus;
  groundedPlaceId: string | null;       // Linked canonical placeId once verified
  rejectionReason?: string;
  moderatedBy?: string;                 // 'SYSTEM_PIPELINE' or moderator UID
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Flutter Client Submission Alignment
Matches `toSubmissionMap()` in Developer D's `SpotCard`:
```dart
Map<String, dynamic> toSubmissionMap() => {
  'mapsLink': mapsLink,
  'infoParagraph': infoParagraph,
  'photoUrls': photoUrls,
  'isVerified': false,
  'createdAt': DateTime.now().toIso8601String(),
};
```
Upon cloud function ingestion, this is wrapped into `ContributionDocument`.
