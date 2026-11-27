/**
 * Firebase Cloud Functions Entrypoint
 * Neighborhood Guide App — Startup Buildathon 2026
 */

import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { geminiApiKey } from "./config/secrets";
import { adminApp } from "./config/firebase";

// Enforce standard Cloud Functions resource footprint across all 2nd-gen services
setGlobalOptions({
  region: "us-central1",
  cpu: "gcf_gen1",
  memory: "256MiB",
  maxInstances: 10,
});

/**
 * Health check endpoint for backend infrastructure validation.
 */
export const healthCheck = onRequest(
  { secrets: [geminiApiKey] },
  (request, response) => {
    logger.info("Healthcheck invoked", {
      structuredData: true,
      path: request.path,
    });

    response.status(200).json({
      status: "healthy",
      service: "neighborhoodguide-backend",
      firebaseApp: adminApp.name,
      runtime: `Node.js ${process.version}`,
      timestamp: new Date().toISOString(),
    });
  }
);


/**
 * Export Contribution persistence functions (Task A3).
 */
export * as Contributions from "./contributions/index.js";

/**
 * Export Preferences, Groups, and Capacity functions (Task A4).
 */
export * as Preferences from "./preferences/index.js";
export * as Groups from "./groups/index.js";
export * as Capacity from "./capacity/index.js";

/**
 * Export Google Maps Platform, Places, Routes, and Crowd services (Developer C).
 */
export * as Maps from "./maps/index.js";

/**
 * Export Contributor Ecosystem and Monetization functions (Task A5).
 */
export * as Monetization from "./monetization/index.js";

/**
 * Export Street Assistance and Gemini Live functions (Task B5).
 */
export * as Assistance from "./ai/controllers/assistance-controller.js";

/**
 * Export Local & On-Device AI functions (Task B6).
 */
export * as LocalAI from "./ai/controllers/local-ai-controller.js";

/**
 * Export Agent Skills & Continue in Gemini functions (Task B7).
 */
export * as Skills from "./ai/controllers/skills-controller.js";

/**
 * Export Community Dialect, Crowd & Safety/Hygiene Verification functions (Stage 1).
 */
export * as Community from "./community/community-signals-controller.js";

/**
 * Export AI Vector Discovery & Solo/Group Taste Matchmaking functions (Stage 2).
 */
export * as Discovery from "./discovery/discovery-controller.js";
