import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// Rôles des comptes organisateurs, gérés dans l'app (page Équipe) et
// stockés dans Firestore : staff_roles/{email en minuscules}.
// - admin : accès à tout le backoffice (guichet, stats, configuration, équipe)
// - guichet : accès au guichet et aux stats
// Un compte connecté sans rôle n'a accès à aucune page du backoffice.
//
// Les rôles sont rattachés à l'email et non au compte Firebase : ils
// resteront valables avec une connexion SSO (myFLA) plus tard.
export const ROLES = {
  ADMIN: "admin",
  GUICHET: "guichet"
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.GUICHET]: "Guichet"
};

export const STAFF_ROLES_COLLECTION = "staff_roles";

// Propriétaire : toujours admin, même sans document dans staff_roles, pour
// qu'on ne puisse jamais perdre tout accès. Même liste dans isOwner() de
// firestore.rules.
export const OWNER_EMAILS = ["margot.laporte@fla.lu", "communication@fla.lu"];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isOwnerEmail(email) {
  return OWNER_EMAILS.includes(normalizeEmail(email));
}

export async function fetchUserRole(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  if (isOwnerEmail(normalizedEmail)) {
    return ROLES.ADMIN;
  }

  const snapshot = await getDoc(doc(db, STAFF_ROLES_COLLECTION, normalizedEmail));
  const role = snapshot.exists() ? snapshot.data().role : null;

  return Object.values(ROLES).includes(role) ? role : null;
}

export function roleSatisfies(role, requiredRole) {
  if (!role) {
    return false;
  }

  return role === ROLES.ADMIN || role === requiredRole;
}
