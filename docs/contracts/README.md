# Canonical Shared Contracts & API Specifications

**Task Reference:** Task A2 â€” Shared Data Models and API Contracts
**Coordinator:** Developer A (Backend Infrastructure & Canonical Contracts)
**Stakeholders:** Developer B (AI Integration), Developer C (Maps & Routing), Developer D (Flutter Client & Offline Storage)

---

## 1. Directory Structure

```
docs/contracts/
â”œâ”€â”€ 00-architecture-and-conventions.md        # Firestore conventions, ID prefixes, timestamps, API envelopes
â”œâ”€â”€ 01-users-and-roles.md                     # Domain 01: User accounts, roles, auth permissions
â”œâ”€â”€ 02-traveler-preferences.md                # Domain 02: Personal taste vectors, dietary, budget, accessibility
â”œâ”€â”€ 03-local-contributions.md                 # Domain 03: Community spot submissions & moderation lifecycle
â”œâ”€â”€ 04-voice-photo-assets.md                  # Domain 04: Cloud Storage assets, audio voice notes, photo processing
â”œâ”€â”€ 05-contributor-attribution-verification.md# Domain 05: Contributor tiers, badges, verification audit trail
â”œâ”€â”€ 06-places-and-spot-cards.md               # Domain 06: Canonical place records, SpotCard, Drift SQLite mapping
â”œâ”€â”€ 07-venue-capacity-and-alternatives.md     # Domain 07: Real-time hourly capacity, crowd throttling, plan-B alternatives
â”œâ”€â”€ 08-routes-and-route-stops.md              # Domain 08: Pedestrian walking routes, waypoints, encoded polylines
â”œâ”€â”€ 09-groups-and-taste-matching.md           # Domain 09: Multi-traveler group sessions, consensus blend, dietary union
â”œâ”€â”€ 10-offline-neighborhood-packs.md          # Domain 10: Downloadable offline packs, SHA-256 manifests, Drift sync
â”œâ”€â”€ 11-contributor-rewards-and-tips.md        # Domain 11: Micro-tipping transactions & contributor reward ledger
â”œâ”€â”€ 12-route-passes-and-subscriptions.md      # Domain 12: Route passes, merchant partner perks, subscriptions
â”œâ”€â”€ COORDINATION_LOG.md                       # Reviews, stakeholder feedback, and unresolved decisions log
â””â”€â”€ samples/                                  # Canonical sample JSON fixtures for every contract
    â”œâ”€â”€ 01-user-role.sample.json
    â”œâ”€â”€ 02-traveler-preferences.sample.json
    â”œâ”€â”€ 03-local-contribution.sample.json
    â”œâ”€â”€ 04-voice-photo-asset.sample.json
    â”œâ”€â”€ 05-contributor-verification.sample.json
    â”œâ”€â”€ 06-place-spot-card.sample.json
    â”œâ”€â”€ 07-venue-capacity-alternatives.sample.json
    â”œâ”€â”€ 08-walking-route.sample.json
    â”œâ”€â”€ 09-group-taste-matching.sample.json
    â”œâ”€â”€ 10-offline-pack-manifest.sample.json
    â”œâ”€â”€ 11-contributor-reward-tip.sample.json
    â”œâ”€â”€ 12-route-pass-subscription.sample.json
    â”œâ”€â”€ api-success-envelope.sample.json
    â””â”€â”€ api-error-envelope.sample.json
```

---

## 2. Canonical TypeScript Types & Validators
All contracts are defined with strict TypeScript interfaces and Zod runtime validation schemas located in:
`functions/src/types/contracts/index.ts`

Automated test suite validating all 12 domains:
`functions/tests/contracts.test.ts`
