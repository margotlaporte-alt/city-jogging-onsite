import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export const DEFAULT_APP_CONFIG = {
  onsiteActiveEdition: "city-jogging-2025",
  importTargetEdition: "city-jogging-2026"
};

const getRuntimeAppConfigCallable = httpsCallable(functions, "getRuntimeAppConfig");
const saveRuntimeAppConfigCallable = httpsCallable(functions, "saveRuntimeAppConfig");

function normalizeEdition(value, fallbackValue) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || fallbackValue;
}

export function sanitizeAppConfig(data = {}) {
  return {
    onsiteActiveEdition: normalizeEdition(
      data.onsiteActiveEdition,
      DEFAULT_APP_CONFIG.onsiteActiveEdition
    ),
    importTargetEdition: normalizeEdition(
      data.importTargetEdition,
      DEFAULT_APP_CONFIG.importTargetEdition
    )
  };
}

export function subscribeToAppConfig(onValue, onError) {
  let isActive = true;
  let timeoutId = null;

  const poll = async () => {
    try {
      const nextConfig = await loadAppConfig();

      if (!isActive) {
        return;
      }

      onValue(nextConfig);
    } catch (error) {
      if (isActive && onError) {
        onError(error);
      }
    } finally {
      if (isActive) {
        timeoutId = window.setTimeout(poll, 5000);
      }
    }
  };

  poll();

  return () => {
    isActive = false;

    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };
}

export async function loadAppConfig() {
  const response = await getRuntimeAppConfigCallable();
  return sanitizeAppConfig(response.data || {});
}

export async function saveAppConfig(partialConfig) {
  const response = await saveRuntimeAppConfigCallable(partialConfig);
  return sanitizeAppConfig(response.data || partialConfig);
}

export function getEditionYear(edition) {
  const match = String(edition || "").match(/(20\d{2})$/);
  return match ? match[1] : String(edition || "");
}
