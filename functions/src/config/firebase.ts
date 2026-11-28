import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

/**
 * Initializes Firebase Admin SDK singleton.
 */
export function getFirebaseAdminApp() {
  if (getApps().length === 0) {
    return initializeApp();
  }
  return getApps()[0];
}

export const adminApp = getFirebaseAdminApp();
export const db = getFirestore(adminApp);
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // Settings already applied in hot-reloaded or test runtime
}
export const storage = getStorage(adminApp);
export const auth = getAuth(adminApp);
