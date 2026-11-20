# Domain 04: Voice/Photo Assets & Processing Status

**Contract Reference:** `docs/contracts/04-voice-photo-assets.md`
**Firestore Subcollection / Document:** `contributions/{contributionId}/assets/{assetId}`
**Primary Stakeholders:** Developer A (Storage & Processing Status), Developer B (Gemini Multimodal Analysis), Developer D (Flutter Audio & Image Picker)
**Sample Payload:** [docs/contracts/samples/04-voice-photo-asset.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/04-voice-photo-asset.sample.json)

---

## 1. Scope & Ownership
Governs raw media files uploaded to Cloud Storage (voice recordings, street signage photos) and tracks their multimodal AI processing status.

---

## 2. Canonical TypeScript Interface

```typescript
export type AssetType = 'AUDIO_VOICE_NOTE' | 'STREET_PHOTO' | 'MENU_PHOTO' | 'STOREFRONT_PHOTO';
export type ProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ExtractedPracticalDetails {
  openingHoursMentioned?: string;
  signatureDishesOrItems: string[];
  priceLevelNote?: string;
  cashOnlyWarning: boolean;
  insiderTips: string[];
}

export interface VoicePhotoAssetDocument {
  assetId: string;                      // Unique asset UUID
  contributionId: string;               // Parent contribution UUID
  assetType: AssetType;
  storagePath: string;                  // e.g. "contributions/contrib_123/voice_456.m4a"
  downloadUrl: string;                  // Public signed or CDN URL
  mimeType: string;                     // e.g. "audio/mp4", "image/jpeg"
  fileSizeBytes: number;
  processingStatus: ProcessingStatus;
  aiExtractionResult: {
    detectedLanguage?: string;          // e.g. "kn-IN", "ta-IN", "hi-IN", "en"
    transcription?: string;             // Verbatim transcript
    englishTranslation?: string;        // Culturally grounded English translation
    practicalDetails?: ExtractedPracticalDetails;
    ocrDetectedText?: string[];         // Text detected on signage / board
    confidenceScore?: number;           // 0.0 to 1.0
  } | null;
  errorMessage?: string;
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Storage Path Conventions
- Voice notes: `contributions/{contributionId}/audio/{assetId}.m4a`
- Street photos: `contributions/{contributionId}/photos/{assetId}.jpg`
- Spot cards: `spots/{placeId}/photos/{photoId}.jpg`
- User avatars: `users/{userId}/avatar.jpg`
