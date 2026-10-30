import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Valeurs utilisées tant que la config n'a jamais été enregistrée, ou si
// sa lecture échoue.
export const DEFAULT_APP_CONFIG = {
  onsiteActiveEdition: "city-jogging-2026",
  importTargetEdition: "city-jogging-2027"
};

// La config est un document Firestore (lecture publique, écriture réservée
// au personnel, voir firestore.rules). Elle passait avant par les Cloud
// Functions getRuntimeAppConfig / saveRuntimeAppConfig, hors service.
const configRef = doc(db, "app_config", "runtime");

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
    configRef,
    (snapshot) => onValue(sanitizeAppConfig(snapshot.data() || {})),
    onError
  );
}

export async function loadAppConfig() {
  const snapshot = await getDoc(configRef);
  return sanitizeAppConfig(snapshot.data() || {});
}

export async function saveAppConfig(partialConfig) {
  const current = await loadAppConfig();
  const nextConfig = sanitizeAppConfig({ ...current, ...partialConfig });

  await setDoc(configRef, {
    ...nextConfig,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || ""
  });

  return nextConfig;
}

export function getEditionYear(edition) {
  const match = String(edition || "").match(/(20\d{2})$/);
  return match ? match[1] : String(edition || "");
}
