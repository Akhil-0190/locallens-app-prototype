# Domain 01: Users and Roles

**Contract Reference:** `docs/contracts/01-users-and-roles.md`
**Firestore Collection:** `users/{userId}`
**Primary Stakeholders:** Developer A (Backend Auth & Rules), Developer D (Flutter Client Auth)
**Sample Payload:** [docs/contracts/samples/01-user-role.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/01-user-role.sample.json)

---

## 1. Scope & Ownership
Governs user identity, security roles, permissions, and session authorization.

---

## 2. Canonical TypeScript Interface

```typescript
export type UserRole = 'TRAVELER' | 'LOCAL_CONTRIBUTOR' | 'MODERATOR' | 'ADMIN';

export interface UserAccountDocument {
  userId: string;                       // Firebase Auth UID
  email: string | null;                 // User email (null for anonymous auth)
  phoneNumber: string | null;           // Phone authentication number
  displayName: string;                  // User display name
  photoUrl: string | null;              // Avatar URL in Cloud Storage
  role: UserRole;                       // Authorization role
  isAnonymous: boolean;                 // Guest exploration mode
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  savedSpotIds: string[];               // Bookmarked spot IDs (Pocket Guide)
  savedRouteIds: string[];              // Bookmarked route IDs
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
  lastLoginAt: string;                  // ISO 8601 UTC
}
```

---

## 3. Permissions Matrix

| Capability | TRAVELER | LOCAL_CONTRIBUTOR | MODERATOR | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| Browse places & routes | âœ… | âœ… | âœ… | âœ… |
| Save to Pocket Guide | âœ… | âœ… | âœ… | âœ… |
| Join Group Taste Session | âœ… | âœ… | âœ… | âœ… |
| Submit New Local Gem | âŒ | âœ… | âœ… | âœ… |
| Receive Traveler Tips | âŒ | âœ… | âŒ | âŒ |
| Moderate Contributions | âŒ | âŒ | âœ… | âœ… |
| Update Venue Capacity | âŒ | âŒ | âœ… | âœ… |
| System Administration | âŒ | âŒ | âŒ | âœ… |

---

## 4. Security Rules Implementation Note
- User documents can only be written by the authenticated owner (`request.auth.uid == userId`).
- The `role` field cannot be altered by client SDK requests; role elevation requires Cloud Functions Admin SDK.
