// Import des inscriptions faites sur place via le formulaire Microsoft Forms
// (QR code) lors de l'édition 2025, avant l'existence de LeGuichet.
// Fonctions pures : l'analyse se fait avant toute écriture dans Firestore.

export const FORMS_EDITION = "city-jogging-2025";

const COURSE_MAP = {
  "Running 10km": { participationType: "run", distance: "10km" },
  "Running 5km": { participationType: "run", distance: "5km" },
  "Walking 10km": { participationType: "nordic_walk", distance: "10km" },
  "Walking 5km": { participationType: "nordic_walk", distance: "5km" },
  "Mini Laf (7/12 ans)": { participationType: "kids_jogging", distance: "1km" }
};

// Statuts d'une ligne du fichier après analyse.
export const ROW_STATUS = {
  NEW: "new",
  DUPLICATE_IN_FILE: "duplicate-in-file",
  ALREADY_REGISTERED: "already-registered",
  OUTSIDE_EVENT_DAY: "outside-event-day",
  IGNORED_COURSE: "ignored-course"
};

function findColumn(row, prefix) {
  return Object.keys(row).find((key) => key.trim().startsWith(prefix));
}

function cell(row, prefix) {
  const key = findColumn(row, prefix);
  return key ? row[key] : "";
}

function text(value) {
  return String(value ?? "").trim();
}

// Date Excel (nombre de jours depuis 1899-12-30) → "AAAA-MM-JJ".
function excelDateToIso(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().split("T")[0];
  }

  const raw = text(value);

  if (raw.includes("/")) {
    const [day, month, year] = raw.split("/");
    return day && month && year ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  }

  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

function ageAt(birthDate, referenceDate) {
  if (!birthDate || !referenceDate) {
    return null;
  }

  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) {
    return null;
  }

  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

// Beaucoup de réponses ont la date du jour comme date de naissance :
// on ne garde que les âges plausibles.
function isPlausibleAge(age) {
  return age !== null && age >= 3 && age <= 100;
}

function normalizeName(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Clé nom + prénom insensible aux accents, à la casse et à l'inversion
// des deux champs (certains ont mis le prénom dans « Nom »).
export function nameKey(lastName, firstName) {
  return [normalizeName(lastName), normalizeName(firstName)].sort().join("|");
}

function mostFrequent(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
}

export function parseFormsRows(rows) {
  return rows.map((row) => {
    const courseLabel = text(cell(row, "Course"));
    const birthDateRaw = excelDateToIso(cell(row, "Birth date"));

    return {
      formId: text(cell(row, "ID")),
      submittedOn: excelDateToIso(cell(row, "Heure de début")),
      lastName: text(cell(row, "Name / Nom")),
      firstName: text(cell(row, "Firstname / Prénom")),
      birthDateRaw,
      sexLabel: text(cell(row, "Sexe")),
      sex: text(cell(row, "Sexe")).toLowerCase().startsWith("wom") ? "female" : "male",
      courseLabel,
      course: COURSE_MAP[courseLabel] || null,
      email: text(cell(row, "Mail")),
      street: text(cell(row, "Number and street")),
      city: text(cell(row, "City")),
      country: text(cell(row, "Country")),
      futureContactConsent: text(cell(row, "Do you agree")).toLowerCase() === "yes"
    };
  });
}

export function analyzeFormsImport(parsedRows, existingRegistrations) {
  const eventDay = mostFrequent(parsedRows.map((row) => row.submittedOn));

  const entries = parsedRows.map((row) => {
    const age = ageAt(row.birthDateRaw, eventDay);
    const hasPlausibleBirthDate = isPlausibleAge(age);

    return {
      ...row,
      key: nameKey(row.lastName, row.firstName),
      birthDate: hasPlausibleBirthDate ? row.birthDateRaw : "",
      age: hasPlausibleBirthDate ? age : null,
      status: ROW_STATUS.NEW,
      duplicateOf: null,
      existingMatch: null
    };
  });

  entries.forEach((entry) => {
    if (entry.submittedOn !== eventDay) {
      entry.status = ROW_STATUS.OUTSIDE_EVENT_DAY;
    } else if (!entry.course) {
      entry.status = ROW_STATUS.IGNORED_COURSE;
    }
  });

  // Doublons dans le fichier : on garde la réponse avec une date de
  // naissance plausible, sinon la première envoyée.
  const groups = new Map();
  entries
    .filter((entry) => entry.status === ROW_STATUS.NEW)
    .forEach((entry) => {
      groups.set(entry.key, [...(groups.get(entry.key) || []), entry]);
    });

  groups.forEach((group) => {
    if (group.length < 2) {
      return;
    }

    const keeper = group.find((entry) => entry.birthDate) || group[0];
    group
      .filter((entry) => entry !== keeper)
      .forEach((entry) => {
        entry.status = ROW_STATUS.DUPLICATE_IN_FILE;
        entry.duplicateOf = keeper.formId;
      });
  });

  // Déjà inscrits dans l'édition (pré-inscrits Miles, guichet, ou import
  // précédent de ce même fichier).
  const existingByKey = new Map();
  existingRegistrations.forEach((registration) => {
    const key = nameKey(registration.lastName, registration.firstName);
    existingByKey.set(key, [...(existingByKey.get(key) || []), registration]);
  });

  entries
    .filter((entry) => entry.status === ROW_STATUS.NEW)
    .forEach((entry) => {
      const matches = (existingByKey.get(entry.key) || []).filter(
        (registration) => registration.externalRegistrationId !== formsExternalId(entry.formId)
      );

      if (matches.length > 0) {
        entry.status = ROW_STATUS.ALREADY_REGISTERED;
        entry.existingMatch = matches[0];
      }
    });

  const counts = Object.values(ROW_STATUS).reduce(
    (result, status) => ({
      ...result,
      [status]: entries.filter((entry) => entry.status === status).length
    }),
    {}
  );

  return { eventDay, entries, counts };
}

// Les règles Firestore n'acceptent qu'une liste fermée de champs : on
// réutilise externalRegistrationId pour retrouver la ligne du formulaire.
function formsExternalId(formId) {
  return `forms-${formId}`;
}

export function formsRegistrationDocId(entry) {
  return `forms_${FORMS_EDITION}_${entry.formId}`;
}

export function buildFormsRegistration(entry, { fileName, importedAt }) {
  return {
    registrationCode: `QR-2025-${entry.formId.padStart(4, "0")}`,
    source: "public-form",
    externalRegistrationId: formsExternalId(entry.formId),
    eventEdition: FORMS_EDITION,
    isPreRegistered: false,

    lastName: entry.lastName,
    firstName: entry.firstName,
    email: entry.email,
    nationality: "",
    club: "Aucun club renseigné",
    sex: entry.sex,
    birthDate: entry.birthDate,
    age: entry.age,
    legalGuardian: "",

    participationType: entry.course.participationType,
    distance: entry.course.distance,

    // Dossard remis sur place en 2025, numéro non relevé dans le formulaire.
    bibNumber: "",
    originalBibNumber: "",
    bibAssigned: true,
    bibReassigned: false,
    bibHistory: [],
    status: "collected",

    dataConsent: true,
    futureContactConsent: entry.futureContactConsent,

    createdAt: `${entry.submittedOn}T12:00:00.000Z`,
    importedAt,
    importedFromFileName: fileName,
    rawCourseLabel: entry.courseLabel
  };
}
