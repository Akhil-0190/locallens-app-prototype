// Callables
export {
  getPreferences,
  updatePreferences,
} from './preferences-controller.js';

// In-process services
export {
  getPreferences as fetchPreferences,
  savePreferences,
  getDefaultPreferences,
  PREFERENCES_COLLECTION,
} from './preferences-service.js';
