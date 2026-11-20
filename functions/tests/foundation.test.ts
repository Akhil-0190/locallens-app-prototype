import { test, describe } from "node:test";
import * as assert from "node:assert";
import { geminiApiKey, mapsApiKey } from "../src/config/secrets";
import { healthCheck } from "../src/index";
import { getFirebaseAdminApp } from "../src/config/firebase";

describe("Backend Foundation Tests", () => {
  test("Firebase Admin app initializes properly", () => {
    const app = getFirebaseAdminApp();
    assert.ok(app, "Firebase Admin app instance should be defined");
    assert.strictEqual(typeof app.name, "string");
  });

  test("Secret parameters are defined with expected keys", () => {
    assert.strictEqual(geminiApiKey.name, "GEMINI_API_KEY");
    assert.strictEqual(mapsApiKey.name, "MAPS_API_KEY");
  });

  test("Health check cloud function is exported", () => {
    assert.ok(healthCheck, "healthCheck function should be defined");
    assert.strictEqual(typeof healthCheck, "function");
  });

  test("Official @google/genai module can be resolved", async () => {
    const genaiModule = await import("@google/genai");
    assert.ok(genaiModule, "@google/genai module should be importable");
    assert.ok(genaiModule.GoogleGenAI, "GoogleGenAI constructor should exist");
  });
});
