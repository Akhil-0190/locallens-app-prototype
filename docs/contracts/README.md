# Shared Data Contracts

This directory contains the canonical schemas and data contracts shared between:
- **Developer A**: Backend infrastructure, Firestore, Cloud Functions, and deployment.
- **Developer B**: AI implementation, model behavior, and server-side Gemini processing.
- **Developer C**: Google Maps Platform, routing, place verification inputs, and capacity management.
- **Developer D**: Flutter client UI, Drift/SQLite offline database, and Android native bridge.

## Contract Process

1. **Proposal**: Any developer proposing a new contract or schema updates submits a specification or draft JSON in `docs/contracts/<contract-name>.md`.
2. **Coordination**: Before any Firestore schema, Cloud Function payload, or offline sync model is implemented, required fields from B, C, and D must be gathered.
3. **Publication**: Once agreed upon, canonical JSON examples are placed in `docs/contracts/samples/`.
4. **Breaking Changes**: Zero uncoordinated breaking changes are permitted. All modifications require notice to affected owners.

## Active Contracts Roadmap

- `01-auth-user.md`: User profiles, roles, and preferences (Developer A & D).
- `02-places-capacity.md`: Place records, crowd capacity, and verification inputs (Developer A & C).
- `03-routes-navigation.md`: Route definitions and coordinates (Developer A & C).
- `04-ai-recommendations.md`: Gemini prompt/response schemas and persisted AI results (Developer A & B).
- `05-contributions.md`: Community contributions and moderation pipeline (Developer A, B, & D).
- `06-offline-pack.md`: Manifest and sqlite sync payload for offline usage (Developer A & D).
