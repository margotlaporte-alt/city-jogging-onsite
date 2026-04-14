import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const DEFAULT_APP_CONFIG = {
  onsiteActiveEdition: "city-jogging-2025",
  importTargetEdition: "city-jogging-2026"
};

const appConfigRef = doc(db, "app_config", "runtime");

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
  return onSnapshot(
    appConfigRef,
    (snapshot) => {
      onValue(sanitizeAppConfig(snapshot.data() || {}));
    },
    onError
  );
}

export async function loadAppConfig() {
  const snapshot = await getDoc(appConfigRef);
  return sanitizeAppConfig(snapshot.data() || {});
}

export async function saveAppConfig(partialConfig) {
  const payload = {};

  if ("onsiteActiveEdition" in partialConfig) {
    payload.onsiteActiveEdition = normalizeEdition(
      partialConfig.onsiteActiveEdition,
      DEFAULT_APP_CONFIG.onsiteActiveEdition
    );
  }

  if ("importTargetEdition" in partialConfig) {
    payload.importTargetEdition = normalizeEdition(
      partialConfig.importTargetEdition,
      DEFAULT_APP_CONFIG.importTargetEdition
    );
  }

  payload.updatedAt = new Date().toISOString();

  await setDoc(appConfigRef, payload, { merge: true });
}

export function getEditionYear(edition) {
  const match = String(edition || "").match(/(20\d{2})$/);
  return match ? match[1] : String(edition || "");
}
