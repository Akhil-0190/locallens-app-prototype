# Part 3 — Defect Register

**Project:** Startup Buildathon India 2026 — Neighborhood Guide App (LocalLens)  
**Developer:** Developer D  
**Scope:** Exhaustive catalog of all defects, discrepancies, and external limitations identified during the repository audit across D1–D7.

---

## 1. Defect Severity Definitions

* **Critical:** Security/authorization failure, financial integrity error, crash on core user path, or fundamental architecture violation.
* **High:** A major promised user journey is broken, incomplete, or misrepresented.
* **Medium:** A secondary feature, edge-case failure path, or contract discrepancy is defective.
* **Low / Cosmetic:** Minor UI overflow, text formatting imperfection, or documentation clarification.

---

## 2. Defect and Limitation Master Catalog

| Defect ID | Affected Req | Severity | Area & Responsible Owner | Description of Defect / Discrepancy | Root Cause | Status & Resolution / Fix Applied | Re-Test Verification |
|:---:|:---:|:---:|:---:|---|---|:---:|:---:|
| **DEF-01** | `D-MONET-004` | Low | UI / Developer D | RenderFlex horizontal layout overflow on `route_pass_screen.dart` active pass headers with long tier enum strings. | `Text` widget rendered inside unconstrained horizontal `Row` without `Expanded` wrapper. | **FIXED** (Wrapped `pass.tier.displayName` in `Expanded` widget). | **PASS** (`test/monetization_test.dart`) |
| **DEF-02** | `D-MONET-003` | Medium | Client / Developer D | Pre-initiation tipping sheet displayed client-calculated 5% fee breakdown prior to receiving canonical backend intent. | Premature local math in UI contradicted canonical rule that backend computes authoritative platform fee. | **FIXED** (Removed client math; UI displays fee and net credit only upon receiving backend response). | **PASS** (`test/monetization_test.dart`) |
| **DEF-03** | `D-APP-001` | Medium | Config / Developer D | Broad `deprecated_member_use: ignore` in `analysis_options.yaml` suppressed warnings project-wide. | Loose analyzer rule masked potential deprecations across multiple packages. | **FIXED** (Reverted global suppression; applied line-level ignores to imports only). | **PASS** (`flutter analyze`: 0 issues) |
| **DEF-04** | `D-TRAVEL-003` | High | External / Architecture | Google Crowdsource lacks public developer API/SDK for direct programmatic data retrieval. | Third-party platform constraint; documented in `docs/crowdsource-access-investigation.md`. | **RESOLVED BY DESIGN** (Grounding achieved via insider voice memos + Google Search grounding). | Verified via documentation audit. |
| **DEF-05** | `D-OFFLINE-006` | High | External / Dev A & C | Offline vector map tile pre-caching is unavailable in Google Maps Platform Flutter SDK. | Google Maps SDK does not support downloading vector map tiles for offline rendering. | **HONESTLY DISCLOSED** (Classified as **Unavailable**; spot cards, audio notes, and routes preserved offline). | Verified via UI badges & tests. |
| **DEF-06** | `D-STREET-003` | High | AI / Developer B | Real-time bidirectional voice translation (Gemini Live) pending unmerged branch `feature/B5-live-assistance`. | Developer B's B5 task is in-progress and not merged into `origin/main`. | **MITIGATED WITH DISCLOSURE** (Client provides interactive dialogue with explicit `[Sample AI: Simulated B5 response]` badge). | `test/route_assistance_test.dart` (Test 5) |
| **DEF-07** | `D-MAPS-002` | Low | UI / Developer D | In `WalkingRouteScreen`, walking step durations under 60 seconds rendered as `~0 min`. | Integer division `durationSeconds ~/ 60` yielded `0` for steps between 1 and 59 seconds. | **FIXED** (Updated formatter: `${step.durationSeconds < 60 ? "< 1 min" : "~${step.durationSeconds ~/ 60} min"}`). | **PASS** (`test/route_assistance_test.dart`) |
| **DEF-08** | `D-DEMO-001` | Low | Docs / Developer D | `demo-runbook.md` step 1 described shell tabs as `Pocket Guide`, `Match Vibe`, `Add Gem` without clarifying index 0 vs active default index 1. | In `app_router.dart`, `Match Vibe` is branch index 0, `Pocket Guide` is branch index 1 (default), and `Add Gem` is branch index 2. | **FIXED** (Updated runbook to explicitly reference `Match Vibe` [0], `Pocket Guide` [1, active], `Add Gem` [2]). | **PASS** (`test/acceptance_matrix_test.dart`) |
| **DEF-09** | `D-COLLAB-A-001`| High | Cloud / Developer A | Live Cloud Functions and Firestore security rules not yet deployed to live Google Cloud environment. | Developer A has merged backend code, but live production deployment requires cloud credentials. | **PENDING DEV A CLOUD DEPLOYMENT** (Client operates cleanly against in-memory and test harnesses). | `functions/` tests pass locally. |
| **DEF-10** | `D-ANDROID-004` | High | AI / Developer B | On-device Gemini Nano / Gemma 4 E2B model binaries not provisioned by Developer B. | Edge AI binaries require device download pipelines and compatible NPU/RAM hardware. | **HONESTLY HANDLED BY CONTRACT** (Kotlin bridge honestly returns `MODEL_NOT_DOWNLOADED` without fabricated NPU claims). | `test/native_platform_test.dart` |
