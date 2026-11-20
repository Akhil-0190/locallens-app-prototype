import { defineSecret } from "firebase-functions/params";

/**
 * Cloud Secret Manager bindings for Firebase Cloud Functions (v2).
 * Secrets are injected into the runtime environment without ever being
 * bundled in client code or source control.
 */
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const mapsApiKey = defineSecret("MAPS_API_KEY");
