/**
 * Firebase Cloud Functions Entrypoint
 * Neighborhood Guide App — Startup Buildathon 2026
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { geminiApiKey } from "./config/secrets";
import { adminApp } from "./config/firebase";

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
 * Export AI services.
 */
export * as AI from "./ai/index.js";

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
