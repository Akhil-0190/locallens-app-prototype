# Structured Prompt and Output Schema Conventions

**Project:** Startup Buildathon 2026 — Neighborhood Guide App  
**Role:** Developer B (AI & Model Integration)  
**SDK:** `@google/genai` (Official TypeScript SDK, Node.js 22+)  

> [!IMPORTANT]
> **Preliminary AI Schemas Notice:**  
> The schemas defined in this document and in `functions/src/ai/schemas/types.ts` are **preliminary AI prompt/extraction contracts** owned by Developer B. They are **not** independently finalized replacements for Developer A's canonical Firebase/Firestore backend schemas. During Task B2, Developer B will coordinate with Developer A to reconcile and map these extraction outputs directly into Developer A's canonical contribution and place schemas (Task A2).

---

## 1. Core Principles

1. **Deterministic Structured JSON:**  
   Every analytical and extraction model call must request `responseMimeType: "application/json"` and pass a formal schema via `responseSchema` or enforce validation via Zod schemas.
2. **Double Validation Pipeline:**  
   - Level 1: Gemini API native schema enforcement at generation time.
   - Level 2: Strict Zod runtime validation (`safeParse`) on the returned JSON object before returning to business logic.
3. **Resilience to Code Fences:**  
   The validator automatically strips Markdown wrapping (e.g. ` ```json ... ``` `) if present in raw model output before JSON parsing.
4. **Low Temperature for Extraction:**  
   Extraction and scoring tasks operate at `temperature: 0.1 - 0.2` to eliminate hallucination, ensure adherence to factual ground evidence, and stabilize categorical enum ratings.

---

## 2. Standard Schema Definitions

All schemas are defined in `functions/src/ai/schemas/types.ts`:

### A. Authenticity & Tourist Trap Assessment (`AuthenticityAssessmentSchema`)
Evaluates whether a venue or establishment is a genuine neighborhood staple or an inflated commercial tourist trap:

```typescript
export const AuthenticityAssessmentSchema = z.object({
  placeName: z.string(),
  authenticityScore: z.number().min(0).max(100),
  touristTrapLikelihood: z.enum(['LOW', 'MODERATE', 'HIGH', 'SEVERE']),
  signals: z.object({
    isMassMarketCommercial: z.boolean(),
    hasAggressiveTouting: z.boolean(),
    inflatedPricingDetected: z.boolean(),
    traditionalCraftOrRecipe: z.boolean(),
  }),
  localSentiment: z.object({
    localResidentRatioEstimate: z.number().min(0).max(1),
    residentPerceptionSummary: z.string(),
  }),
  recommendedTiming: z.string(),
  evidenceSummary: z.string(),
});
```

### B. Regional Voice & Photo Practical Extraction (`VoicePhotoExtractionSchema`)
Transcribes spoken regional languages (Hindi, Kannada, Tamil, Marathi, Telugu, etc.), translates to English, and isolates actionable operational details:

```typescript
export const VoicePhotoExtractionSchema = z.object({
  detectedLanguage: z.string(),
  originalTranscript: z.string(),
  englishTranslation: z.string(),
  practicalDetails: z.object({
    openingHoursMentioned: z.string().optional(),
    signatureDishesOrItems: z.array(z.string()),
    priceLevelNote: z.string().optional(),
    cashOnlyWarning: z.boolean(),
    insiderTips: z.array(z.string()),
  }),
  authenticitySignals: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
});
```

### C. Group Preference Blending (`GroupPreferenceBlendSchema`)
Combines multiple individual member profiles, resolves conflicting dietary or atmosphere preferences, and calculates consensus recommendations.

---

## 3. Server-Side Execution Pattern

To invoke any AI service function from Cloud Functions:

```typescript
import { AI } from '../index.js';

// Example: Authenticity assessment called from a Firestore Cloud Function
export async function onReviewSubmitted(placeName: string, reviewText: string) {
  try {
    const result = await AI.assessAuthenticity(placeName, reviewText);
    
    console.log(`Evaluated by: ${result.modelUsed} (fallback: ${result.fallbackTriggered})`);
    console.log(`Authenticity Score: ${result.data.authenticityScore}/100`);
    console.log(`Risk: ${result.data.touristTrapLikelihood}`);

    return result.data;
  } catch (err) {
    if (err instanceof AI.AIRateLimitError) {
      // Handle rate limit exhaustion or queue for background retry
    } else if (err instanceof AI.AISchemaValidationError) {
      // Handle malformed structure
    }
    throw err;
  }
}
```

---

## 4. Error Handling Hierarchy

All errors thrown by the AI subsystem inherit from `AIBaseError`:

* `AIAuthenticationError` (401): Missing or invalid `GEMINI_API_KEY`.
* `AIRateLimitError` (429): Quota exhausted or rate limit hit. Automatically retried with backoff.
* `AIModelUnavailableError` (503): Model temporarily down. Triggers fallback cascading.
* `AISchemaValidationError` (422): Model output violated the defined schema structure.
* `AITimeoutError` (408): Request exceeded configured timeout threshold.
