import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  runTransaction,
  writeBatch
} from "firebase/firestore";
import { db } from "../services/firebase";
import { nationalityOptions, clubsMain, clubsSecondary } from "../data/options";
import {
  DEFAULT_APP_CONFIG,
  getEditionYear,
  loadAppConfig
} from "../services/appConfig";
import cityLogo from "../assets/jpmorgan.png";
import flaLogo from "../assets/fla.png";

const NO_CLUB_VALUES = [
  "No club provided",
  "Aucun club renseigné",
  "Kein Verein angegeben"
];

function PublicPage() {
  const [lang, setLang] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");
  const [submittedCodes, setSubmittedCodes] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [activeEdition, setActiveEdition] = useState(
    DEFAULT_APP_CONFIG.onsiteActiveEdition
  );
  const editionYear = getEditionYear(activeEdition);

  const t = {
    en: {
      title: `J.P. Morgan City Jogging ${editionYear}`,
      subtitle: "On-site registration",
      submitAll: "Confirm registration",
      submitting: "Registration in progress...",
      another: "Register more participants",
      success: "Registrations confirmed",
      instruction: "Please give these numbers at the desk",
      lastName: "Last name",
      firstName: "First name",
      email: "Email address",
      nationality: "Nationality",
      club: "Club",
      noClub: "No club provided",
      sex: "Sex",
      male: "Male",
      female: "Female",
      birthDate: "Date of birth",
      legalGuardian: "Legal guardian",
      participationType: "Participation type",
      run: "Run",
      nordicWalk: "Nordic walking",
      kidsJogging: "Kids Jogging",
      distance: "Distance",
      organizerAccess: "Organizer area",
      requiredFieldsNote: "* Required fields",
      underFiveError: "Registration is not allowed for children under 5 years old.",
      kidsAgeError: "Kids Jogging is only available for children aged 5 to 14.",
      submitError:
        "An error occurred while saving the registration. Please try again.",
      dataConsent:
        "I authorize the processing of my personal data for the purpose of this race.",
      futureConsent:
        "I authorize the FLA to contact me again for future editions of the J.P. Morgan City Jogging.",
      confirmRegistration: "Confirm registration",
      addParticipant: "Add a second participant",
      participantList: "Participants added",
      currentFormTitle: "New participant",
      edit: "Open",
      collapse: "Collapse",
      remove: "Remove",
      noParticipantYet: "No participant added yet.",
      formInvalid:
        "Please complete all required fields before adding this participant.",
      batchEmpty:
        "Please add at least one participant before confirming registrations.",
      savingAll: "Saving all registrations...",
      savedCount: "registrations saved successfully.",
      participant: "Participant",
      codeLabel: "Code",
      minorLabel: "Minor",
      yes: "Yes",
      no: "No"
    },
    fr: {
      title: `J.P. Morgan City Jogging ${editionYear}`,
      subtitle: "Inscription sur place",
      submitAll: "Confirmer l'inscription",
      submitting: "Inscription en cours...",
      another: "Faire d’autres inscriptions",
      success: "Inscriptions confirmées",
      instruction: "Présentez ces numéros au guichet",
      lastName: "Nom",
      firstName: "Prénom",
      email: "Adresse mail",
      nationality: "Nationalité",
      club: "Club",
      noClub: "Aucun club renseigné",
      sex: "Sexe",
      male: "Homme",
      female: "Femme",
      birthDate: "Date de naissance",
      legalGuardian: "Responsable légal",
      participationType: "Type de participation",
      run: "Course",
      nordicWalk: "Marche nordique",
      kidsJogging: "Kids Jogging",
      distance: "Distance",
      organizerAccess: "Espace organisateur",
      requiredFieldsNote: "* Champs obligatoires",
      underFiveError:
        "Les inscriptions sont interdites pour les enfants de moins de 5 ans.",
      kidsAgeError: "Le Kids Jogging est réservé aux enfants de 5 à 14 ans.",
      submitError:
        "Une erreur est survenue lors de l’enregistrement. Merci de réessayer.",
      dataConsent:
        "J’autorise le traitement de mes données dans le cadre de la course.",
      futureConsent:
        "J’autorise la FLA à me recontacter pour les éditions futures du J.P. Morgan City Jogging.",
      confirmRegistration: "Confirmer l'inscription",
      addParticipant: "Ajouter un deuxième participant",
      participantList: "Participants ajoutés",
      currentFormTitle: "Nouvelle inscription",
      edit: "Ouvrir",
      collapse: "Replier",
      remove: "Supprimer",
      noParticipantYet: "Aucun participant ajouté pour le moment.",
      formInvalid:
        "Merci de compléter tous les champs obligatoires avant d’ajouter cette personne.",
      batchEmpty:
        "Merci d’ajouter au moins un participant avant de valider les inscriptions.",
      savingAll: "Enregistrement de toutes les inscriptions...",
      savedCount: "inscriptions enregistrées avec succès.",
      participant: "Participant",
      codeLabel: "Code",
      minorLabel: "Mineur",
      yes: "Oui",
      no: "Non"
    },
    de: {
      title: `J.P. Morgan City Jogging ${editionYear}`,
      subtitle: "Anmeldung vor Ort",
      submitAll: "Anmeldung bestätigen",
      submitting: "Anmeldung läuft...",
      another: "Weitere Teilnehmer anmelden",
      success: "Anmeldungen bestätigt",
      instruction: "Bitte diese Nummern am Schalter angeben",
      lastName: "Nachname",
      firstName: "Vorname",
      email: "E-Mail-Adresse",
      nationality: "Nationalität",
      club: "Verein",
      noClub: "Kein Verein angegeben",
      sex: "Geschlecht",
      male: "Mann",
      female: "Frau",
      birthDate: "Geburtsdatum",
      legalGuardian: "Gesetzlicher Vertreter",
      participationType: "Teilnahmeart",
      run: "Lauf",
      nordicWalk: "Nordic Walking",
      kidsJogging: "Kids Jogging",
      distance: "Distanz",
      organizerAccess: "Organisatorenbereich",
      requiredFieldsNote: "* Pflichtfelder",
      underFiveError:
        "Anmeldungen für Kinder unter 5 Jahren sind nicht erlaubt.",
      kidsAgeError:
        "Kids Jogging ist nur für Kinder von 5 bis 14 Jahren verfügbar.",
      submitError:
        "Beim Speichern der Anmeldung ist ein Fehler aufgetreten. Bitte erneut versuchen.",
      dataConsent:
        "Ich erlaube die Verarbeitung meiner Daten im Rahmen dieses Laufs.",
      futureConsent:
        "Ich erlaube der FLA, mich für zukünftige Ausgaben des J.P. Morgan City Jogging erneut zu kontaktieren.",
      confirmRegistration: "Anmeldung bestätigen",
      addParticipant: "Zweiten Teilnehmer hinzufügen",
      participantList: "Hinzugefügte Teilnehmer",
      currentFormTitle: "Neue Anmeldung",
      edit: "Öffnen",
      collapse: "Einklappen",
      remove: "Entfernen",
      noParticipantYet: "Noch kein Teilnehmer hinzugefügt.",
      formInvalid:
        "Bitte alle Pflichtfelder ausfüllen, bevor dieser Teilnehmer hinzugefügt wird.",
      batchEmpty:
        "Bitte mindestens einen Teilnehmer hinzufügen, bevor die Anmeldungen bestätigt werden.",
      savingAll: "Alle Anmeldungen werden gespeichert...",
      savedCount: "Anmeldungen erfolgreich gespeichert.",
      participant: "Teilnehmer",
      codeLabel: "Code",
      minorLabel: "Minderjährig",
      yes: "Ja",
      no: "Nein"
    }
  };

  const texts = t[lang];

  const initialForm = useMemo(
    () => ({
      lastName: "",
      firstName: "",
      email: "",
      nationality: "",
      club: texts.noClub,
      sex: "",
      birthDate: "",
      legalGuardian: "",
      participationType: "run",
      distance: "6km",
      dataConsent: false,
      futureContactConsent: false
    }),
    [texts.noClub]
  );

  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    email: "",
    nationality: "",
    club: t.en.noClub,
    sex: "",
    birthDate: "",
    legalGuardian: "",
    participationType: "run",
    distance: "6km",
    dataConsent: false,
    futureContactConsent: false
  });

  const [pendingRegistrations, setPendingRegistrations] = useState([]);

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);

    if (Number.isNaN(birth.getTime())) return null;

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age -= 1;
    }

    return age;
  };

  useEffect(() => {
    if (NO_CLUB_VALUES.includes(formData.club)) {
      setFormData((prev) => ({
        ...prev,
        club: texts.noClub
      }));
    }

    setPendingRegistrations((prev) =>
      prev.map((registration) => {
        if (NO_CLUB_VALUES.includes(registration.club)) {
          return {
            ...registration,
            club: texts.noClub
          };
        }
        return registration;
      })
    );
  }, [lang, texts.noClub, formData.club]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.participationType === "kids_jogging") {
        if (prev.distance !== "1km") {
          return {
            ...prev,
            distance: "1km"
          };
        }
        return prev;
      }

      if (!["6km", "10km"].includes(prev.distance)) {
        return {
          ...prev,
          distance: "6km"
        };
      }

      return prev;
    });
  }, [formData.participationType]);

  useEffect(() => {
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        const config = await loadAppConfig();

        if (!isMounted) {
          return;
        }

        setActiveEdition(config.onsiteActiveEdition);
      } catch (error) {
        console.error("Erreur chargement edition publique :", error);
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const getAgeError = (data) => {
    const age = calculateAge(data.birthDate);
    const isUnderFive = age !== null && age < 5;
    const isKidsJogging = data.participationType === "kids_jogging";

    if (!data.birthDate) return "";

    if (isUnderFive) {
      return texts.underFiveError;
    }

    if (isKidsJogging && (age < 5 || age > 14)) {
      return texts.kidsAgeError;
    }

    return "";
  };

  const isRegistrationValid = (data) => {
    const age = calculateAge(data.birthDate);
    const isMinor = age !== null && age < 18;
    const currentAgeError = getAgeError(data);

    return (
      data.lastName.trim() !== "" &&
      data.firstName.trim() !== "" &&
      data.nationality.trim() !== "" &&
      data.sex.trim() !== "" &&
      data.birthDate.trim() !== "" &&
      data.participationType.trim() !== "" &&
      data.distance.trim() !== "" &&
      (!isMinor || data.legalGuardian.trim() !== "") &&
      !currentAgeError &&
      data.dataConsent
    );
  };

  const isRegistrationEmpty = (data) =>
    data.lastName.trim() === "" &&
    data.firstName.trim() === "" &&
    data.email.trim() === "" &&
    data.nationality.trim() === "" &&
    (data.club.trim() === "" || NO_CLUB_VALUES.includes(data.club)) &&
    data.sex.trim() === "" &&
    data.birthDate.trim() === "" &&
    data.legalGuardian.trim() === "" &&
    data.dataConsent === false &&
    data.futureContactConsent === false;

  const normalizeRegistration = (data) => {
    const age = calculateAge(data.birthDate);
    const isMinor = age !== null && age < 18;

    return {
      tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      email: data.email.trim(),
      nationality: data.nationality.trim(),
      club: data.club.trim() === "" ? texts.noClub : data.club.trim(),
      sex: data.sex,
      birthDate: data.birthDate,
      age,
      legalGuardian: isMinor ? data.legalGuardian.trim() : "",
      participationType: data.participationType,
      distance:
        data.participationType === "kids_jogging"
          ? "1km"
          : ["6km", "10km"].includes(data.distance)
            ? data.distance
            : "6km",
      dataConsent: data.dataConsent,
      futureContactConsent: data.futureContactConsent
    };
  };

  const reserveCodes = async (count) => {
    const ref = doc(db, "counters", "onsiteRegistrationCounter");

    return runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(ref);
      const currentValue = counterDoc.data()?.value || 0;
      const start = currentValue + 1;
      const end = currentValue + count;

      transaction.set(ref, { value: end }, { merge: true });

      return Array.from({ length: count }, (_, index) => {
        const num = start + index;
        return `CJ-${String(num).padStart(4, "0")}`;
      });
    });
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handlePendingChange = (tempId, event) => {
    const { name, value, type, checked } = event.target;

    setPendingRegistrations((prev) =>
      prev.map((registration) => {
        if (registration.tempId !== tempId) return registration;

        const updated = {
          ...registration,
          [name]: type === "checkbox" ? checked : value
        };

        if (name === "participationType") {
          if (value === "kids_jogging") {
            updated.distance = "1km";
          } else if (!["6km", "10km"].includes(updated.distance)) {
            updated.distance = "6km";
          }
        }

        return updated;
      })
    );
  };

  const handleClubFocus = () => {
    if (
      formData.club === t.en.noClub ||
      formData.club === t.fr.noClub ||
      formData.club === t.de.noClub
    ) {
      setFormData((prev) => ({
        ...prev,
        club: ""
      }));
    }
  };

  const handleClubBlur = () => {
    if (formData.club.trim() === "") {
      setFormData((prev) => ({
        ...prev,
        club: texts.noClub
      }));
    }
  };

  const handlePendingClubFocus = (tempId) => {
    setPendingRegistrations((prev) =>
      prev.map((registration) => {
        if (registration.tempId !== tempId) return registration;

        if (
          registration.club === t.en.noClub ||
          registration.club === t.fr.noClub ||
          registration.club === t.de.noClub
        ) {
          return {
            ...registration,
            club: ""
          };
        }

        return registration;
      })
    );
  };

  const handlePendingClubBlur = (tempId) => {
    setPendingRegistrations((prev) =>
      prev.map((registration) => {
        if (registration.tempId !== tempId) return registration;

        if (registration.club.trim() === "") {
          return {
            ...registration,
            club: texts.noClub
          };
        }

        return registration;
      })
    );
  };

  const handleAddParticipant = () => {
    setSubmitError("");
    setSubmitInfo("");

    if (!isRegistrationValid(formData)) {
      setSubmitError(texts.formInvalid);
      return;
    }

    const normalized = normalizeRegistration(formData);

    setPendingRegistrations((prev) => [...prev, normalized]);
    setExpandedItems((prev) => ({
      ...prev,
      [normalized.tempId]: false
    }));
    setFormData(initialForm);
  };

  const submitRegistrations = async (registrations) => {
    const hasInvalidPending = registrations.some(
      (registration) => !isRegistrationValid(registration)
    );

    if (hasInvalidPending) {
      setSubmitError(texts.formInvalid);
      return;
    }

    setIsSubmitting(true);
    setSubmitInfo(texts.savingAll);

    try {
      const codes = await reserveCodes(registrations.length);
      const batch = writeBatch(db);

      registrations.forEach((registration, index) => {
        const docRef = doc(collection(db, "onsite_registrations"));
        const calculatedAge = calculateAge(registration.birthDate);

        batch.set(docRef, {
          registrationCode: codes[index],
          lastName: registration.lastName.trim(),
          firstName: registration.firstName.trim(),
          email: registration.email.trim(),
          nationality: registration.nationality.trim(),
          club:
            registration.club.trim() === ""
              ? texts.noClub
              : registration.club.trim(),
          sex: registration.sex,
          birthDate: registration.birthDate,
          age: calculatedAge,
          legalGuardian:
            calculatedAge !== null && calculatedAge < 18
              ? registration.legalGuardian.trim()
              : "",
          participationType: registration.participationType,
          distance:
            registration.participationType === "kids_jogging"
              ? "1km"
              : ["6km", "10km"].includes(registration.distance)
                ? registration.distance
                : "6km",
          dataConsent: registration.dataConsent,
          futureContactConsent: registration.futureContactConsent,
          bibAssigned: false,
          bibNumber: "",
          originalBibNumber: "",
          status: "pending",
          source: "public-form",
          eventEdition: activeEdition,
          isPreRegistered: false,
          bibReassigned: false,
          bibHistory: [],
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();

      setSubmittedCodes(
        registrations.map((registration, index) => ({
          fullName: `${registration.lastName} ${registration.firstName}`,
          code: codes[index]
        }))
      );

      setPendingRegistrations([]);
      setExpandedItems({});
      setFormData(initialForm);
      setSubmitInfo(`${registrations.length} ${texts.savedCount}`);
    } catch (error) {
      console.error(error);
      setSubmitError(
        `Erreur d'enregistrement : ${error?.code || "sans code"}${
          error?.message ? ` — ${error.message}` : ""
        }`
      );
      setSubmitInfo("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRegistration = async () => {
    setSubmitError("");
    setSubmitInfo("");

    const registrationsToSubmit = [...pendingRegistrations];
    const hasCurrentRegistration = !isRegistrationEmpty(formData);

    if (hasCurrentRegistration) {
      if (!isRegistrationValid(formData)) {
        setSubmitError(texts.formInvalid);
        return;
      }

      registrationsToSubmit.push(normalizeRegistration(formData));
    }

    if (registrationsToSubmit.length === 0) {
      setSubmitError(texts.formInvalid);
      return;
    }

    await submitRegistrations(registrationsToSubmit);
  };

  const toggleExpanded = (tempId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [tempId]: !prev[tempId]
    }));
  };

  const handleRemoveParticipant = (tempId) => {
    setPendingRegistrations((prev) =>
      prev.filter((registration) => registration.tempId !== tempId)
    );

    setExpandedItems((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const handleSubmitAll = async (event) => {
    event.preventDefault();

    setSubmitError("");
    setSubmitInfo("");

    const registrationsToSubmit = [...pendingRegistrations];
    const hasCurrentRegistration = !isRegistrationEmpty(formData);

    if (hasCurrentRegistration) {
      if (!isRegistrationValid(formData)) {
        setSubmitError(texts.formInvalid);
        return;
      }

      registrationsToSubmit.push(normalizeRegistration(formData));
    }

    if (registrationsToSubmit.length === 0) {
      setSubmitError(texts.batchEmpty);
      return;
    }

    await submitRegistrations(registrationsToSubmit);
  };

  const resetAll = () => {
    setSubmittedCodes([]);
    setSubmitError("");
    setSubmitInfo("");
    setIsSubmitting(false);
    setPendingRegistrations([]);
    setExpandedItems({});
    setFormData(initialForm);
  };

  const languageButtons = (
    <div style={styles.lang}>
      <button
        type="button"
        onClick={() => setLang("en")}
        style={{
          ...styles.langButton,
          ...(lang === "en" ? styles.langActive : {})
        }}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLang("fr")}
        style={{
          ...styles.langButton,
          ...(lang === "fr" ? styles.langActive : {})
        }}
      >
        FR
      </button>

      <button
        type="button"
        onClick={() => setLang("de")}
        style={{
          ...styles.langButton,
          ...(lang === "de" ? styles.langActive : {})
        }}
      >
        DE
      </button>
    </div>
  );

  const renderRegistrationFields = (
    data,
    onChange,
    onClubFocus,
    onClubBlur,
    isPending = false
  ) => {
    const age = calculateAge(data.birthDate);
    const isMinor = age !== null && age < 18;
    const isKidsJogging = data.participationType === "kids_jogging";
    const currentAgeError = getAgeError(data);

    const safeDistance = isKidsJogging
      ? "1km"
      : ["6km", "10km"].includes(data.distance)
        ? data.distance
        : "6km";

    return (
      <div style={styles.formSection}>
        <input
          name="lastName"
          value={data.lastName}
          onChange={onChange}
          placeholder={`${texts.lastName} *`}
          style={styles.input}
        />

        <input
          name="firstName"
          value={data.firstName}
          onChange={onChange}
          placeholder={`${texts.firstName} *`}
          style={styles.input}
        />

        <input
          name="email"
          type="email"
          value={data.email}
          onChange={onChange}
          placeholder={texts.email}
          style={styles.input}
        />

        <input
          name="nationality"
          list={
            isPending ? `nationalities-pending-${data.tempId}` : "nationalities"
          }
          value={data.nationality}
          onChange={onChange}
          placeholder={`${texts.nationality} *`}
          style={styles.input}
        />
        <datalist
          id={
            isPending ? `nationalities-pending-${data.tempId}` : "nationalities"
          }
        >
          {nationalityOptions[lang].map((nationality) => (
            <option key={nationality} value={nationality} />
          ))}
        </datalist>

        <input
          name="club"
          list={isPending ? `clubs-pending-${data.tempId}` : "clubs"}
          value={data.club}
          onChange={onChange}
          onFocus={onClubFocus}
          onBlur={onClubBlur}
          placeholder={texts.club}
          style={styles.input}
        />
        <datalist id={isPending ? `clubs-pending-${data.tempId}` : "clubs"}>
          {[...clubsMain, ...clubsSecondary].map((club) => (
            <option key={club} value={club} />
          ))}
        </datalist>

        <select
          name="sex"
          value={data.sex}
          onChange={onChange}
          style={styles.input}
        >
          <option value="">{`${texts.sex} *`}</option>
          <option value="male">{texts.male}</option>
          <option value="female">{texts.female}</option>
        </select>

        <input
          name="birthDate"
          type="date"
          value={data.birthDate}
          onChange={onChange}
          style={styles.input}
        />

        <select
          name="participationType"
          value={data.participationType}
          onChange={onChange}
          style={styles.input}
        >
          <option value="run">{texts.run}</option>
          <option value="nordic_walk">{texts.nordicWalk}</option>
          <option value="kids_jogging">{texts.kidsJogging}</option>
        </select>

        <select
          name="distance"
          value={safeDistance}
          onChange={onChange}
          style={styles.input}
          disabled={isKidsJogging}
        >
          {isKidsJogging ? (
            <option value="1km">1 km</option>
          ) : (
            <>
              <option value="6km">6 km</option>
              <option value="10km">10 km</option>
            </>
          )}
        </select>

        {isMinor && (
          <input
            name="legalGuardian"
            value={data.legalGuardian}
            onChange={onChange}
            placeholder={`${texts.legalGuardian} *`}
            style={styles.input}
          />
        )}

        {currentAgeError && <div style={styles.errorBox}>{currentAgeError}</div>}

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            name="dataConsent"
            checked={data.dataConsent}
            onChange={onChange}
            style={styles.checkboxInput}
          />
          <span>
            {texts.dataConsent} <span style={styles.required}>*</span>
          </span>
        </label>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            name="futureContactConsent"
            checked={data.futureContactConsent}
            onChange={onChange}
            style={styles.checkboxInput}
          />
          <span>{texts.futureConsent}</span>
        </label>
      </div>
    );
  };

  if (submittedCodes.length > 0) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.topBar}>
            <div style={styles.logoGroup}>
              <img src={cityLogo} alt="J.P. Morgan" style={styles.logo} />
              <img src={flaLogo} alt="FLA" style={styles.logo} />
            </div>

            {languageButtons}
          </div>

          <h1 style={styles.title}>{texts.title}</h1>
          <p style={styles.subtitle}>{texts.subtitle}</p>

          <div style={styles.successBox}>
            <h2 style={styles.successTitle}>{texts.success}</h2>
            <p style={styles.successText}>{texts.instruction}</p>

            <div style={styles.codesList}>
              {submittedCodes.map((item) => (
                <div key={item.code} style={styles.codeRow}>
                  <div style={styles.codeName}>{item.fullName}</div>
                  <div style={styles.codeSmall}>{item.code}</div>
                </div>
              ))}
            </div>

            <button style={styles.button} onClick={resetAll}>
              {texts.another}
            </button>
          </div>

          <div style={styles.bottomLinkWrapper}>
            <Link to="/guichet" style={styles.secondaryLink}>
              {texts.organizerAccess}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <div style={styles.logoGroup}>
            <img src={cityLogo} alt="J.P. Morgan" style={styles.logo} />
            <img src={flaLogo} alt="FLA" style={styles.logo} />
          </div>

          {languageButtons}
        </div>

        <h1 style={styles.title}>{texts.title}</h1>
        <p style={styles.subtitle}>{texts.subtitle}</p>

        <form onSubmit={handleSubmitAll} style={styles.form} noValidate>
          {pendingRegistrations.length > 0 && (
            <>
              <div style={styles.sectionTitle}>{texts.participantList}</div>

              {pendingRegistrations.map((registration, index) => {
                const isExpanded = expandedItems[registration.tempId] ?? false;
                const registrationAge = calculateAge(registration.birthDate);
                const registrationError = getAgeError(registration);
                const isValid = isRegistrationValid(registration);

                return (
                  <div key={registration.tempId} style={styles.pendingCard}>
                    <div style={styles.pendingHeader}>
                      <div style={styles.pendingSummary}>
                        <div style={styles.pendingName}>
                          {registration.lastName} {registration.firstName}
                        </div>
                        <div style={styles.pendingMeta}>
                          {texts.participant} #{index + 1} ·{" "}
                          {registration.participationType === "kids_jogging"
                            ? "1km"
                            : registration.distance}{" "}
                          · {texts.minorLabel}:{" "}
                          {registrationAge !== null && registrationAge < 18
                            ? texts.yes
                            : texts.no}
                        </div>
                        {!isValid && (
                          <div style={styles.pendingWarning}>
                            {registrationError || texts.formInvalid}
                          </div>
                        )}
                      </div>

                      <div style={styles.pendingActions}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(registration.tempId)}
                          style={styles.smallButton}
                        >
                          {isExpanded ? texts.collapse : texts.edit}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveParticipant(registration.tempId)
                          }
                          style={styles.smallDangerButton}
                        >
                          {texts.remove}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={styles.pendingBody}>
                        {renderRegistrationFields(
                          registration,
                          (event) =>
                            handlePendingChange(registration.tempId, event),
                          () => handlePendingClubFocus(registration.tempId),
                          () => handlePendingClubBlur(registration.tempId),
                          true
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={styles.sectionTitle}>{texts.currentFormTitle}</div>

          <div style={styles.newFormCard}>
            {renderRegistrationFields(
              formData,
              handleChange,
              handleClubFocus,
              handleClubBlur
            )}

            <div style={styles.requiredNote}>{texts.requiredFieldsNote}</div>

            <div style={styles.actionRow}>
              <button
                type="button"
                onClick={handleConfirmRegistration}
                disabled={isSubmitting}
                style={{
                  ...styles.button,
                  flex: 1,
                  ...(isSubmitting ? styles.buttonDisabled : {})
                }}
              >
                {isSubmitting ? texts.submitting : texts.confirmRegistration}
              </button>

              <button
                type="button"
                onClick={handleAddParticipant}
                disabled={isSubmitting}
                style={{
                  ...styles.secondaryButton,
                  flex: 1,
                  ...(isSubmitting ? styles.buttonDisabled : {})
                }}
              >
                {texts.addParticipant}
              </button>
            </div>
          </div>

          {submitInfo && <div style={styles.infoBox}>{submitInfo}</div>}
          {submitError && <div style={styles.errorBox}>{submitError}</div>}

        </form>

        <div style={styles.bottomLinkWrapper}>
          <Link to="/guichet" style={styles.secondaryLink}>
            {texts.organizerAccess}
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  langActive: {
    background: "#4f46e5",
    color: "white",
    border: "1px solid #4f46e5"
  },
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f4f7fb",
    padding: "24px"
  },
  card: {
    background: "white",
    padding: "32px",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "760px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "18px"
  },
  logoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  logo: {
    height: "46px",
    width: "auto",
    objectFit: "contain"
  },
  lang: {
    display: "flex",
    gap: "8px"
  },
  langButton: {
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "8px",
    padding: "6px 10px",
    cursor: "pointer"
  },
  title: {
    margin: "0 0 6px 0",
    textAlign: "center",
    fontSize: "32px",
    fontWeight: 700
  },
  subtitle: {
    margin: "0 0 24px 0",
    textAlign: "center",
    color: "#667085",
    fontSize: "16px"
  },
  form: {
    display: "grid",
    gap: "14px"
  },
  actionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  formSection: {
    display: "grid",
    gap: "12px"
  },
  input: {
    height: "48px",
    padding: "0 14px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "15px",
    width: "100%",
    boxSizing: "border-box"
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "14px",
    lineHeight: "1.5",
    color: "#344054"
  },
  checkboxInput: {
    marginTop: "3px",
    flexShrink: 0
  },
  required: {
    color: "#dc2626"
  },
  requiredNote: {
    fontSize: "12px",
    color: "#667085",
    marginTop: "2px"
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px"
  },
  infoBox: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px"
  },
  button: {
    marginTop: "8px",
    height: "50px",
    border: "none",
    borderRadius: "10px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer"
  },
  secondaryButton: {
    marginTop: "8px",
    height: "50px",
    border: "1px solid #4f46e5",
    borderRadius: "10px",
    background: "#eef2ff",
    color: "#312e81",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer"
  },
  buttonDisabled: {
    background: "#c7c9d9",
    cursor: "not-allowed"
  },
  bottomLinkWrapper: {
    marginTop: "18px",
    textAlign: "center"
  },
  secondaryLink: {
    color: "#4f46e5",
    textDecoration: "none",
    fontWeight: 600
  },
  successBox: {
    textAlign: "center",
    paddingTop: "8px"
  },
  successTitle: {
    marginBottom: "12px"
  },
  successText: {
    marginBottom: "18px",
    color: "#475467"
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#111827",
    marginTop: "6px"
  },
  emptyBox: {
    background: "#f9fafb",
    border: "1px dashed #d0d5dd",
    borderRadius: "12px",
    padding: "16px",
    color: "#667085",
    fontSize: "14px"
  },
  pendingCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    overflow: "hidden",
    background: "#fff"
  },
  pendingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px 16px",
    background: "#f9fafb"
  },
  pendingSummary: {
    flex: 1,
    minWidth: 0
  },
  pendingName: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#111827"
  },
  pendingMeta: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#6b7280"
  },
  pendingWarning: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#b91c1c",
    fontWeight: 600
  },
  pendingActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0
  },
  smallButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    borderRadius: "8px",
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 600
  },
  smallDangerButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "8px",
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 600
  },
  pendingBody: {
    padding: "16px"
  },
  newFormCard: {
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    borderRadius: "14px",
    padding: "16px"
  },
  codesList: {
    display: "grid",
    gap: "12px",
    margin: "20px 0"
  },
  codeRow: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px 16px"
  },
  codeName: {
    fontWeight: 700,
    color: "#111827",
    marginBottom: "8px"
  },
  codeSmall: {
    fontSize: "24px",
    background: "#4f46e5",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    display: "inline-block",
    fontWeight: 700
  }
};

export default PublicPage;
