import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, doc, runTransaction } from "firebase/firestore";
import { db } from "../services/firebase";
import { nationalityOptions, clubsMain, clubsSecondary } from "../data/options";
import cityLogo from "../assets/jpmorgan.png";
import flaLogo from "../assets/fla.png";

const ACTIVE_EVENT_EDITION = "city-jogging-2025";

function PublicPage() {
  const [lang, setLang] = useState("en");

  const t = {
    en: {
      title: "J.P. Morgan City Jogging 2026",
      subtitle: "On-site registration",
      submit: "Register",
      another: "Register another participant",
      success: "Registration confirmed",
      instruction: "Please give this number at the desk",
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
      dataConsent:
        "I authorize the processing of my personal data for the purpose of this race.",
      futureConsent:
        "I authorize the FLA to contact me again for future editions of the J.P. Morgan City Jogging."
    },
    fr: {
      title: "J.P. Morgan City Jogging 2026",
      subtitle: "Inscription sur place",
      submit: "Valider l’inscription",
      another: "Faire une autre inscription",
      success: "Inscription confirmée",
      instruction: "Présentez ce numéro au guichet",
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
      dataConsent:
        "J’autorise le traitement de mes données dans le cadre de la course.",
      futureConsent:
        "J’autorise la FLA à me recontacter pour les éditions futures du J.P. Morgan City Jogging."
    },
    de: {
      title: "J.P. Morgan City Jogging 2026",
      subtitle: "Anmeldung vor Ort",
      submit: "Anmeldung bestätigen",
      another: "Neue Anmeldung",
      success: "Anmeldung bestätigt",
      instruction: "Bitte diese Nummer am Schalter angeben",
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
      dataConsent:
        "Ich erlaube die Verarbeitung meiner Daten im Rahmen dieses Laufs.",
      futureConsent:
        "Ich erlaube der FLA, mich für zukünftige Ausgaben des J.P. Morgan City Jogging erneut zu kontaktieren."
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

  const [code, setCode] = useState("");
  const [ageError, setAgeError] = useState("");

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

  const age = calculateAge(formData.birthDate);
  const isMinor = age !== null && age < 18;
  const isUnderFive = age !== null && age < 5;
  const isKidsJogging = formData.participationType === "kids_jogging";

  useEffect(() => {
    const noClubValues = [t.en.noClub, t.fr.noClub, t.de.noClub];

    if (noClubValues.includes(formData.club)) {
      setFormData((prev) => ({
        ...prev,
        club: texts.noClub
      }));
    }
  }, [lang, texts.noClub, formData.club]);

  useEffect(() => {
    if (formData.participationType === "kids_jogging") {
      setFormData((prev) => ({
        ...prev,
        distance: "1km"
      }));
    }
  }, [formData.participationType]);

  useEffect(() => {
    if (!formData.birthDate) {
      setAgeError("");
      return;
    }

    if (isUnderFive) {
      setAgeError(texts.underFiveError);
      return;
    }

    if (isKidsJogging && (age < 5 || age > 14)) {
      setAgeError(texts.kidsAgeError);
      return;
    }

    setAgeError("");
  }, [
    formData.birthDate,
    formData.participationType,
    age,
    isUnderFive,
    isKidsJogging,
    texts.underFiveError,
    texts.kidsAgeError
  ]);

  const generateCode = async () => {
    const ref = doc(db, "counters", "onsiteRegistrationCounter");

    const num = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(ref);
      const next = (counterDoc.data()?.value || 0) + 1;
      transaction.set(ref, { value: next }, { merge: true });
      return next;
    });

    return `CJ-${String(num).padStart(4, "0")}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
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

  const isFormValid =
    formData.lastName.trim() !== "" &&
    formData.firstName.trim() !== "" &&
    formData.nationality.trim() !== "" &&
    formData.sex.trim() !== "" &&
    formData.birthDate.trim() !== "" &&
    formData.participationType.trim() !== "" &&
    formData.distance.trim() !== "" &&
    (!isMinor || formData.legalGuardian.trim() !== "") &&
    !ageError &&
    formData.dataConsent;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    const newCode = await generateCode();

    await addDoc(collection(db, "onsite_registrations"), {
      registrationCode: newCode,
      lastName: formData.lastName.trim(),
      firstName: formData.firstName.trim(),
      email: formData.email.trim(),
      nationality: formData.nationality.trim(),
      club: formData.club.trim() === "" ? texts.noClub : formData.club.trim(),
      sex: formData.sex,
      birthDate: formData.birthDate,
      age,
      legalGuardian: isMinor ? formData.legalGuardian.trim() : "",
      participationType: formData.participationType,
      distance: formData.distance,
      dataConsent: formData.dataConsent,
      futureContactConsent: formData.futureContactConsent,
      bibAssigned: false,
      bibNumber: "",
      originalBibNumber: "",
      status: "pending",
      source: "public-form",
      eventEdition: ACTIVE_EVENT_EDITION,
      isPreRegistered: false,
      bibReassigned: false,
      bibHistory: [],
      createdAt: new Date().toISOString()
    });

    setCode(newCode);
  };

  const resetForm = () => {
    setCode("");
    setAgeError("");
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

  if (code) {
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
            <div style={styles.code}>{code}</div>
            <p style={styles.successText}>{texts.instruction}</p>

            <button style={styles.button} onClick={resetForm}>
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

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder={`${texts.lastName} *`}
            style={styles.input}
            required
          />

          <input
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder={`${texts.firstName} *`}
            style={styles.input}
            required
          />

          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder={texts.email}
            style={styles.input}
          />

          <input
            name="nationality"
            list="nationalities"
            value={formData.nationality}
            onChange={handleChange}
            placeholder={`${texts.nationality} *`}
            style={styles.input}
            required
          />
          <datalist id="nationalities">
            {nationalityOptions[lang].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <input
            name="club"
            list="clubs"
            value={formData.club}
            onChange={handleChange}
            onFocus={handleClubFocus}
            onBlur={handleClubBlur}
            placeholder={texts.club}
            style={styles.input}
          />
          <datalist id="clubs">
            {[...clubsMain, ...clubsSecondary].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <select
            name="sex"
            value={formData.sex}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">{`${texts.sex} *`}</option>
            <option value="male">{texts.male}</option>
            <option value="female">{texts.female}</option>
          </select>

          <input
            name="birthDate"
            type="date"
            value={formData.birthDate}
            onChange={handleChange}
            style={styles.input}
            required
          />

          <select
            name="participationType"
            value={formData.participationType}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="run">{texts.run}</option>
            <option value="nordic_walk">{texts.nordicWalk}</option>
            <option value="kids_jogging">{texts.kidsJogging}</option>
          </select>

          <select
            name="distance"
            value={formData.distance}
            onChange={handleChange}
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
              value={formData.legalGuardian}
              onChange={handleChange}
              placeholder={`${texts.legalGuardian} *`}
              style={styles.input}
              required
            />
          )}

          {ageError && <div style={styles.errorBox}>{ageError}</div>}

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              name="dataConsent"
              checked={formData.dataConsent}
              onChange={handleChange}
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
              checked={formData.futureContactConsent}
              onChange={handleChange}
              style={styles.checkboxInput}
            />
            <span>{texts.futureConsent}</span>
          </label>

          <div style={styles.requiredNote}>{texts.requiredFieldsNote}</div>

          <button
            type="submit"
            disabled={!isFormValid}
            style={{
              ...styles.button,
              ...(!isFormValid ? styles.buttonDisabled : {})
            }}
          >
            {texts.submit}
          </button>
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
  code: {
    fontSize: "32px",
    background: "#4f46e5",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
    margin: "12px auto 16px auto",
    maxWidth: "280px",
    fontWeight: 700
  },
  successText: {
    marginBottom: "18px",
    color: "#475467"
  }
};

export default PublicPage;