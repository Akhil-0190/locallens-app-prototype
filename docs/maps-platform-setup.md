# Google Maps Platform Setup & API Verification Audit

**Project:** LocalLens (Startup Buildathon India 2026)  
**Assigned Developer:** Developer C — Maps Platform, Grounding, Routes & Crowd Management  
**Task ID:** C1 — Google Maps Platform Foundation  
**Branch:** `feature/C1-maps-foundation`  
**Date:** November 20, 2026  

---

## 1. Executive Summary & Verification Findings

During Task C1 foundation inspection, live probe requests were executed against Google Cloud API endpoints using the repository's configured Google credentials:

| API / Service | Status | Live Probe Response | Impact & Resolution |
| :--- | :--- | :--- | :--- |
| **Places API (New)** (`places.googleapis.com`) | ❌ **Unavailable** | HTTP 403 `PERMISSION_DENIED` (`ACCESS_DENIED`) | Needs enablement in Google Cloud Console + billing account linkage. |
| **Routes API** (`routes.googleapis.com`) | ❌ **Unavailable** | HTTP 403 `PERMISSION_DENIED` (`ACCESS_DENIED`) | Needs enablement in Google Cloud Console + billing account linkage. |
| **Maps SDK for Android** | ⏳ **Pending Config** | Client Android key requires SHA-1 fingerprint restriction | Configured via `AndroidManifest.xml` with API restrictions. |
| **Google Search Grounding** | ⏳ **Coordination** | Provided via Vertex AI / Gemini API | Coordinated with Developer B. |

> [!WARNING]
> **Unavailable Access Explicitly Recorded:** In strict compliance with working rules, place details and route metrics are **never fabricated**. The Maps engine incorporates an offline mock fallback layer returning clearly labeled sample fixtures (`isMockData: true`) when live API access is denied or unconfigured.

---

## 2. API Key Architecture & Security Restrictions

To prevent key theft, quota exhaustion, and billing abuse:

### A. Server-Side Keys (Cloud Functions)
- **Scope:** Google Places API (New), Google Routes API.
- **Storage:** Google Cloud Secret Manager or Firebase Functions environment variables (`GOOGLE_MAPS_API_KEY`).
- **Restrictions:**
  - **API Restriction:** Restrict key strictly to `Places API (New)` and `Routes API`.
  - **Application Restriction:** IP address restriction matching Cloud Functions egress IPs (or VPC egress).
- **Prohibition:** NEVER expose this key in Flutter client code or commit to Git.

### B. Client-Side Keys (Flutter Android/iOS Client)
- **Scope:** Google Maps SDK for Android / iOS tile rendering.
- **Restrictions:**
  - **Android:** Restricted to package name `com.innovotribe.locallens` and SHA-1 signing certificates (Debug + Release keystores).
  - **iOS:** Restricted to iOS Bundle Identifier `com.innovotribe.locallens`.
  - **API Restriction:** Restrict key strictly to `Maps SDK for Android` and `Maps SDK for iOS`.

---

## 3. Required Google Cloud Enablement Steps

The Google Cloud Project administrator must enable the following APIs in the Google Cloud Console for project `neighborhoodguideapp`:

1. **Enable Services:**
   ```bash
   gcloud services enable places.googleapis.com --project neighborhoodguideapp
   gcloud services enable routes.googleapis.com --project neighborhoodguideapp
   gcloud services enable maps-android-backend.googleapis.com --project neighborhoodguideapp
   ```
2. **Billing Requirement:**
   - Link an active billing account to the Google Cloud project (Google Maps Platform provides a $200 monthly free tier credit).
3. **Configure Field Masking:**
   - Places API (New) enforces field masking (`X-Goog-FieldMask`). Requesting only required fields minimizes latency and cost (Basic vs. Advanced vs. Preferred pricing tiers).

---

## 4. SDK & API Compatibility

- **Places API (New):**
  - Uses `https://places.googleapis.com/v1/places:searchText` and `:searchNearby`.
  - Replaces legacy Places API (`maps.googleapis.com/maps/api/place/`).
  - Supports modern localized text responses and primary category classifications.
- **Routes API:**
  - Uses `https://routes.googleapis.com/directions/v2:computeRoutes`.
  - Replaces legacy Directions API.
  - Native support for walking mode (`travelMode: "WALK"`), intermediate waypoint optimization, and encoded polylines.
