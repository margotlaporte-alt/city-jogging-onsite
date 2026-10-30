// Rôles des comptes organisateurs.
// - admin : accès à tout le backoffice (guichet, stats, configuration)
// - guichet : accès au guichet et aux stats
// Un compte connecté sans rôle n'a accès à aucune page du backoffice.
// Ajouter ou retirer un email ici, c'est aussi le faire dans isStaff() de
// firestore.rules puis republier les règles dans la console Firebase.
export const ROLES = {
  ADMIN: "admin",
  GUICHET: "guichet"
};

export const USER_ROLES = {
  "margot.laporte@fla.lu": ROLES.ADMIN,
  "communication@fla.lu": ROLES.ADMIN
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getUserRole(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  return USER_ROLES[normalizedEmail] || null;
}

export function hasRole(email, requiredRole) {
  const role = getUserRole(email);

  if (!role) {
    return false;
  }

  if (role === ROLES.ADMIN) {
    return true;
  }

  return role === requiredRole;
}

export function isAdminEmail(email) {
  return getUserRole(email) === ROLES.ADMIN;
}
