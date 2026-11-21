# Google Maps & Google Search Grounding with Truthful Provenance

**Track:** Developer B — AI & Multimodal Lead  
**Task:** Final Handoff 2 — Truth in Advertising & Grounding Compliance  
**Related Tasks:** Task B2 (Voice/Photo Extraction), Task B7 (Agent Skills), Task C2 (Grounding Service, PR #34)  
**Status:** Complete & Verified  

---

## 1. Executive Summary

In response to Developer A's Handoff 2 directive and the findings in `docs/crowdsource-access-investigation.md`, Developer B has implemented an authentic Gemini Grounding strategy for spot-card curation in `functions/src/ai/services/spot-card-synthesis-service.ts`.

This implementation bridges two critical capabilities:
1. **Google Maps & Search Grounding Tools:** Directly integrates `@google/genai` tool structures (`[{ googleMaps: {} }, { googleSearch: {} }]`) using Gemini models (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) to verify place identity, operating hours, addresses, and regional cultural context.
2. **Strict Provenance Separation & Truth-in-Advertising:** Establishes unambiguous classification between Google Maps-grounded data, LocalLens direct community voice memos, and sample fixtures, while explicitly disclosing the lack of a public Google Crowdsource API.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Incoming Spot Synthesis Data                              │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────┤
│ Local Resident Voice Note    │ Google Maps Geospatial Pin   │ Synthetic/Mock Fixture   │
│ (B2 Vernacular Audio Memo)   │ (Developer C Places Ground)  │ (Testing/Demo)           │
└──────────────┬───────────────┴──────────────┬───────────────┴──────────┬───────────────┘
               │                              │                          │
               ▼                              ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               Gemini Grounding Engine (spot-card-synthesis-service.ts)                 │
│                                                                                        │
│  Model: gemini-3.8-flash (fallback: gemini-3.5-flash-lite)                             │
│  Tools: [{ googleMaps: {} }, { googleSearch: {} }]                                    │
│  Grounding Metadata: Maps Chunks (places/{id}, reviews) + Web Chunks (search queries)  │
│  Fail-Open Strategy: 429 RESOURCE_EXHAUSTED cascades to deterministic synthesis       │
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             Truthful Provenance Labeling                               │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────┤
│      COMMUNITY_VERIFIED      │        MAPS_GROUNDED         │      SAMPLE_FIXTURE      │
│  Direct local voice memo     │  Grounded via Google Maps    │  Explicitly marked       │
│  from LocalLens contributors │  Platform Places & Reviews   │  isMockData = true       │
├──────────────────────────────┴──────────────────────────────┴──────────────────────────┤
│                                   HYBRID_VERIFIED                                      │
│           Combines direct resident voice memo with Google Maps grounding               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gemini Grounding Tools Implementation

### Supported GenAI Tool Structure
Using the official `@google/genai` TypeScript SDK (`^3.6.1`), grounding tools are passed via `config.tools`:

```typescript
export function buildGroundingToolsConfig(options?: GroundingExecutionOptions): Array<{ googleMaps?: {}; googleSearch?: {} }> {
  const tools: Array<{ googleMaps?: {}; googleSearch?: {} }> = [];
  const enableMaps = options?.enableMapsGrounding !== false;
  const enableSearch = options?.enableSearchGrounding !== false;

  if (enableMaps) {
    tools.push({ googleMaps: {} });
  }
  if (enableSearch) {
    tools.push({ googleSearch: {} });
  }
  return tools;
}
```

### Live Provider Model Status & Limitations
- **Primary Model:** `gemini-3.8-flash` (confirmed in live API catalog as the primary generation and reasoning model).
- **Fallback Model:** `gemini-3.5-flash-lite` (high-throughput operational model).
- **Legacy Models:** `gemini-2.0-flash` returns `404 NOT_FOUND` from Google's endpoint with instructions to use `gemini-3.8-flash`.
- **Live Provider Testing Observation:** In the test environment, the configured API key returns `429 RESOURCE_EXHAUSTED` (Google AI Studio free-tier quota exhaustion).
- **Fault-Tolerant Fallback:** Rather than crashing or blocking spot creation, `synthesizeSpotCardWithGrounding` catches provider quota failures, marks `executionStatus = 'GROUNDING_QUOTA_FALLBACK'`, and executes deterministic synthesis with authentic provenance labeling.

---

## 3. Truthful Provenance Governance Matrix

| Provenance Badge | Criteria | Attribution Statement | Contract Representation |
| :--- | :--- | :--- | :--- |
| **`COMMUNITY_VERIFIED`** | Contributed by local resident via 2-minute regional voice memo or photo; processed through B2 extraction pipeline. | *"Direct LocalLens community voice contribution processed via vernacular multimodal extraction. (Google Crowdsource lacks public API)."* | `vibeTags: ['provenance:community_verified', 'resident_voice_attested']`<br>`isVerified: false` |
| **`MAPS_GROUNDED`** | Grounded via Google Maps Platform (Places API New, review sentiments, place details). | *"Grounded via Google Maps Platform places, review insights, and geospatial verification."* | `vibeTags: ['provenance:maps_grounded', 'google_maps_grounded']`<br>`isVerified: true` |
| **`HYBRID_VERIFIED`** | Resident voice note corroborated with official Google Maps place listing and coordinates. | *"Hybrid verified: Contributed by local resident voice memo and corroborated with Google Maps Platform geospatial grounding."* | `vibeTags: ['provenance:hybrid_verified', 'community_voice_verified', 'google_maps_grounded']`<br>`isVerified: true` |
| **`SAMPLE_FIXTURE`** | Test fixture, offline mock, or synthetic developer test data. | *"Sample fixture data generated for testing and demonstration."* | `vibeTags: ['provenance:sample_fixture']`<br>`isMockData: true`<br>`isVerified: false` |

---

## 4. Truth-in-Advertising & Anti-Hallucination Invariants

1. **Google Crowdsource Disclosure:**
   LocalLens never claims access to a "Google Crowdsource API". Google Crowdsource is a gamified data collection program without a third-party developer REST API. LocalLens's proprietary community signals originate from direct resident voice memos processed via our vernacular AI pipeline.
2. **Review Separation Invariant:**
   Google Maps place reviews are never rebranded as direct LocalLens community contributions. They are labeled strictly as `GOOGLE_MAPS` grounding sources.
3. **Zero-Hallucination Hours Rule:**
   If operating hours are omitted from both the contributor voice note and Google Maps evidence, the system strictly outputs `'Check Maps for hours'`. It never hallucinates opening times.
4. **Coordinate Delta Honesty:**
   Unverified street carts without confirmed Google Maps locations use baseline coordinates and remain `isVerified = false`.
5. **Fixture Transparency:**
   Sample fixture data is never mixed with live evidence without `isMockData: true` and `SAMPLE_FIXTURE` provenance.

---

## 5. Verification & Test Suite

The dedicated test suite `functions/test/test-handoff2-grounding.ts` verifies all 6 core dimensions:
1. **Tool Configuration:** Verified Maps-only (`[{ googleMaps: {} }]`), Search-only (`[{ googleSearch: {} }]`), and Dual tools.
2. **Provenance Classification:** Verified all 4 badges (`COMMUNITY_VERIFIED`, `MAPS_GROUNDED`, `HYBRID_VERIFIED`, `SAMPLE_FIXTURE`).
3. **Contract Conformance:** Output strictly validates against Developer A's `CanonicalPlaceDocumentSchema`.
4. **Missing Evidence Safety:** Handled missing voice notes and coordinates without hallucination.
5. **Provider Error Resilience:** Proved graceful fallback under 429 quota exhaustion.
6. **Backward Compatibility:** All existing B2 tests (`test-b2-voice-photo-extraction.ts`) continue to pass 100%.

Run command:
```bash
cd functions
npm run test:handoff2
```
Result: **21/21 assertions passed, 0 failures**.
Full regression suite (`npm test`): **317/317 tests passed, 0 failures**.
