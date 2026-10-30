const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Email ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse email invalide.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests":
    "Trop de tentatives échouées. Le compte est temporairement bloqué, réessaie dans quelques minutes.",
  "auth/network-request-failed":
    "Problème de connexion réseau. Vérifie ta connexion internet.",
  "auth/invalid-api-key":
    "Configuration Firebase invalide (clé API manquante ou incorrecte)."
};

export function getAuthErrorMessage(error) {
  const code = error?.code || "";
  const message = AUTH_ERROR_MESSAGES[code] || "Connexion impossible.";

  return code ? `${message} (${code})` : message;
}
