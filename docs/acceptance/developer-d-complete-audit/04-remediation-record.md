# Part 4 — Remediation Record

**Project:** Startup Buildathon India 2026 — Neighborhood Guide App (LocalLens)  
**Developer:** Developer D  
**Scope:** Chronological and technical record of all code remediations, UI bug fixes, contract realignments, and regression verifications executed by Developer D.

---

## 1. Summary of Remediations

* **Total D-Owned Defects Identified:** 6
* **Total D-Owned Defects Remediated:** 6 (100% resolution rate)
* **Regressions Introduced:** 0 (all 59 automated tests passing; 0 analyzer issues)

---

## 2. Detailed Technical Fix Records

### Remediation 1: Turn-by-Turn Duration Formatting Precision
* **Defect ID:** `DEF-07`
* **Requirement ID:** `D-MAPS-002`
* **Affected File:** `lib/screens/walking_route_screen.dart`
* **Root Cause:** Truncating integer division `step.durationSeconds ~/ 60` yielded `0 min` for any walking leg between 1 and 59 seconds, presenting an unintuitive prompt time.
* **Code Change:**
  ```dart
  // Before
  Text('${step.distanceMeters} m • ~${step.durationSeconds ~/ 60} min')

  // After
  Text('${step.distanceMeters} m • ${step.durationSeconds < 60 ? "< 1 min" : "~${step.durationSeconds ~/ 60} min"}')
  ```
* **Test Verification:** `flutter test test/route_assistance_test.dart` passed; UI formatting verified in test.

---

### Remediation 2: Shell Bottom Navigation Order Clarification
* **Defect ID:** `DEF-08`
* **Requirement ID:** `D-DEMO-001`
* **Affected File:** `docs/acceptance/demo-runbook.md`
* **Root Cause:** Runbook walkthrough described shell tabs as `Pocket Guide`, `Match Vibe`, and `Add Gem`, but in `lib/router/app_router.dart`, the destination order is `Match Vibe` (branch 0), `Pocket Guide` (branch 1, active default), and `Add Gem` (branch 2).
* **Code Change:** Updated step 1 in `demo-runbook.md` to explicitly state:
  ```markdown
  - Landing screen defaults to `/guide` (`Pocket Guide Screen`).
  - Bottom navigation displays 3 shell branches: `Match Vibe` (index 0), `Pocket Guide` (index 1, active default), and `Add Gem` (index 2).
  ```
* **Test Verification:** `test/acceptance_matrix_test.dart` (Test 1) verifies correct navigation to each tab via text lookup and indexed branches.

---

### Remediation 3: RenderFlex Overflow Elimination on Route Pass Headers
* **Defect ID:** `DEF-01`
* **Requirement ID:** `D-MONET-004`
* **Affected File:** `lib/screens/route_pass_screen.dart`
* **Root Cause:** Active pass cards placed `pass.tier.displayName` and `tier.displayName` inside an unconstrained horizontal `Row`, causing an 18px RenderFlex overflow on narrow viewport resolutions.
* **Code Change:** Wrapped both title instances in `Expanded` widgets with `TextOverflow.ellipsis`.
* **Test Verification:** `flutter test test/monetization_test.dart` executed without rendering or layout exceptions.

---

### Remediation 4: Decoupling Client-Side Tipping Fee Calculation
* **Defect ID:** `DEF-02`
* **Requirement ID:** `D-MONET-003`
* **Affected File:** `lib/widgets/tipping_modal_sheet.dart`
* **Root Cause:** The tipping modal sheet previously computed a client-side 5% fee breakdown prior to invoking the backend callable, violating the canonical rule that the backend computes platform fees and contributor net earnings.
* **Code Change:** Removed client-side fee arithmetic. The UI now restricts inputs to the valid range (₹10–₹5,000) and displays platform fee and net earnings strictly as returned by the `Monetization-initiateTip` backend response.
* **Test Verification:** Verified via `test/monetization_test.dart` (Tests 8–11).

---

### Remediation 5: Elimination of Broad Deprecation Suppressions
* **Defect ID:** `DEF-03`
* **Requirement ID:** `D-APP-001`
* **Affected File:** `analysis_options.yaml`
* **Root Cause:** A global `deprecated_member_use: ignore` in `analysis_options.yaml` suppressed warnings project-wide, masking potential API shifts.
* **Code Change:** Removed global ignore; applied targeted, line-level `// ignore: deprecated_member_use` only to necessary Material 3 color and theme imports.
* **Test Verification:** `flutter analyze` completed with **0 issues found**.

---

### Remediation 6: Strict Schema Parity on Kotlin AI Channel Bridge
* **Defect ID:** `DEF-10`
* **Requirement ID:** `D-ANDROID-003`, `D-ANDROID-004`
* **Affected Files:** `android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt`, `lib/services/native_platform_service.dart`
* **Root Cause:** Earlier drafts omitted required Developer B telemetry fields (`hasNpu`, `aicoreVersion`, `supportedFeatures`).
* **Code Change:** Restored exact field parity and enforced that all offline inference methods (`summarizeOfflineNote`, `extractOfflineKeywords`, `executeOfflineInference`) return `MODEL_NOT_DOWNLOADED` with zero fabricated NPU claims when model binaries are uninstalled.
* **Test Verification:** `test/native_platform_test.dart` (Tests 1–3) passing.
