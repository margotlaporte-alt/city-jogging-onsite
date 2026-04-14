export const ADMIN_EMAILS = [
  "margot.laporte@fla.lu"
];

export function isAdminEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return ADMIN_EMAILS.some(
    (allowedEmail) =>
      String(allowedEmail || "").trim().toLowerCase() === normalizedEmail
  );
}
