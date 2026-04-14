import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { collection, doc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../services/firebase";
import {
  DEFAULT_APP_CONFIG,
  getEditionYear,
  loadAppConfig,
  saveAppConfig,
} from "../services/appConfig";

function ConfigurationPage() {
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_APP_CONFIG);
  const [importEditionInput, setImportEditionInput] = useState(
    DEFAULT_APP_CONFIG.importTargetEdition
  );

  const activeEditionYear = getEditionYear(config.onsiteActiveEdition);
  const importEditionYear = getEditionYear(config.importTargetEdition);

  useEffect(() => {
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        const nextConfig = await loadAppConfig();

        if (!isMounted) {
          return;
        }

        setConfig(nextConfig);
        setImportEditionInput(nextConfig.importTargetEdition);
      } catch (error) {
        console.error(error);
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatBirthDate = (value) => {
    if (!value) return "";

    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    const raw = String(value).trim();

    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/");
      if (!day || !month || !year) return "";
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return raw;
  };

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

  const mapSex = (value) => {
    if (value === "M") return "male";
    if (value === "F") return "female";
    return "";
  };

  const mapCourse = (courseLabel) => {
    const course = String(courseLabel || "").trim();

    if (course === "City Jogging - 6km") {
      return { participationType: "run", distance: "6km" };
    }

    if (course === "City Jogging - 10km") {
      return { participationType: "run", distance: "10km" };
    }

    if (course === "City walking - Nordic Walking - 6km") {
      return { participationType: "nordic_walk", distance: "6km" };
    }

    if (course === "City walking & Nordic Walking - 10km") {
      return { participationType: "nordic_walk", distance: "10km" };
    }

    if (course === "Kids Jogging – Mini LAF - 1km") {
      return { participationType: "kids_jogging", distance: "1km" };
    }

    return null;
  };

  const normalizeBib = (value) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value).replace(/\.0$/, "").trim();
  };

  const handleSaveImportEdition = async () => {
    const nextEdition = importEditionInput.trim();

    if (!nextEdition) {
      setFeedback("Merci de renseigner une édition cible d'import.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      await saveAppConfig({ importTargetEdition: nextEdition });
      setConfig((prev) => ({
        ...prev,
        importTargetEdition: nextEdition
      }));
      setImportEditionInput(nextEdition);
      setFeedback(`Édition cible d'import enregistrée : ${nextEdition}.`);
    } catch (error) {
      console.error(error);
      setFeedback("Erreur lors de la mise à jour de la configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchOnsiteEdition = async () => {
    const targetEdition = config.importTargetEdition;

    const confirmed = window.confirm(
      `Passer les inscriptions sur place de ${config.onsiteActiveEdition} vers ${targetEdition} ?`
    );

    if (!confirmed) return;

    setLoading(true);
    setFeedback("");

    try {
      await saveAppConfig({ onsiteActiveEdition: targetEdition });
      setConfig((prev) => ({
        ...prev,
        onsiteActiveEdition: targetEdition
      }));
      setFeedback(`Les inscriptions sur place pointent maintenant vers ${targetEdition}.`);
    } catch (error) {
      console.error(error);
      setFeedback("Erreur lors du changement d'édition active.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setFeedback("Merci de sélectionner un fichier Excel.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      let importedCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        const courseLabel = String(row.COURSE || "").trim();

        if (courseLabel === "Garderie") {
          skippedCount += 1;
          continue;
        }

        const courseData = mapCourse(courseLabel);

        if (!courseData) {
          skippedCount += 1;
          continue;
        }

        const externalId = String(row.ID || "").trim();
        if (!externalId) {
          skippedCount += 1;
          continue;
        }

        const birthDate = formatBirthDate(row["DATE DE NAISSANCE"]);
        const age = calculateAge(birthDate);
        const bib = normalizeBib(row.DOSSARD);
        const targetEdition = config.importTargetEdition;

        const registrationCode = `PRE-${String(
          row["ÉDITION"] || getEditionYear(targetEdition) || "TEST"
        )}-${String(importedCount + 1).padStart(4, "0")}`;

        await setDoc(
          doc(db, "onsite_registrations", `prereg_${targetEdition}_${externalId}`),
          {
            registrationCode,
            source: "online-import",
            isPreRegistered: true,
            preRegistrationBadge: "mail",
            externalRegistrationId: externalId,
            eventEdition: targetEdition,

            lastName: String(row.NOM || "").trim(),
            firstName: String(row["PRÉNOM"] || "").trim(),
            email: String(row.COURRIEL || "").trim(),
            nationality: String(row["NATIONALITÉ"] || "").trim(),
            club: String(row["CLUB/ASSOCIATION"] || "").trim() || "Aucun club renseigné",
            sex: mapSex(row.GENRE),
            birthDate,
            age,
            legalGuardian: "",

            participationType: courseData.participationType,
            distance: courseData.distance,

            bibNumber: bib,
            originalBibNumber: bib,
            bibAssigned: !!bib,
            bibDeliveryMode: "postal",
            bibReassigned: false,
            bibHistory: [],
            status: "pre-registered",

            dataConsent: true,
            futureContactConsent:
              String(
                row["Acceptes tu de recevoir des informations par mail de la part de  l'organisation ?"] || ""
              )
                .trim()
                .toLowerCase() === "oui",

            importedAt: new Date().toISOString(),
            importedFromFileName: file.name,
            rawCourseLabel: courseLabel
          },
          { merge: true }
        );

        importedCount += 1;
      }

      setFeedback(
        `Import terminé vers ${config.importTargetEdition}. ${importedCount} pré-inscrit(s) importé(s), ${skippedCount} ligne(s) ignorée(s).`
      );
    } catch (error) {
      console.error(error);
      setFeedback("Erreur pendant l'import.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImportedEdition = async () => {
    const targetEdition = config.importTargetEdition;

    const confirmed = window.confirm(
      `Supprimer uniquement les pré-inscrits importés de l'édition ${targetEdition} ?`
    );

    if (!confirmed) return;

    setLoading(true);
    setFeedback("");

    try {
      const registrationsQuery = query(
        collection(db, "onsite_registrations"),
        where("eventEdition", "==", targetEdition)
      );

      const snapshot = await getDocs(registrationsQuery);
      const docs = snapshot.docs.filter((documentSnapshot) => {
        const data = documentSnapshot.data();
        return data.isPreRegistered && data.source === "online-import";
      });

      if (docs.length === 0) {
        setFeedback("Aucun pré-inscrit importé à supprimer pour cette édition.");
        setLoading(false);
        return;
      }

      const chunkSize = 400;

      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);

        chunk.forEach((documentSnapshot) => {
          batch.delete(documentSnapshot.ref);
        });

        await batch.commit();
      }

      setFeedback(
        `${docs.length} pré-inscription(s) importée(s) supprimée(s) pour ${targetEdition}.`
      );
    } catch (error) {
      console.error(error);
      setFeedback("Erreur lors de la suppression de l'import.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Configuration</h1>
            <p style={styles.text}>
              Prépare l'édition suivante sans changer les inscriptions sur place
              tant que tu ne l'as pas décidé.
            </p>
          </div>

          <Link to="/guichet" style={styles.backLink}>
            Retour au guichet
          </Link>
        </div>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.panelLabel}>Édition active sur place</div>
            <div style={styles.badgePrimary}>
              {config.onsiteActiveEdition} ({activeEditionYear})
            </div>
            <p style={styles.panelText}>
              La page publique, le guichet et les statistiques utilisent cette
              édition.
            </p>

            <button
              onClick={handleSwitchOnsiteEdition}
              disabled={
                loading ||
                config.onsiteActiveEdition === config.importTargetEdition
              }
              style={{
                ...styles.primaryButton,
                ...((loading ||
                  config.onsiteActiveEdition === config.importTargetEdition)
                  ? styles.disabledButton
                  : {})
              }}
            >
              Passer à l'édition {importEditionYear}
            </button>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelLabel}>Édition cible d'import</div>
            <div style={styles.badgeSecondary}>
              {config.importTargetEdition} ({importEditionYear})
            </div>
            <p style={styles.panelText}>
              Les pré-inscriptions importées depuis Miles seront enregistrées
              dans cette édition.
            </p>

            <input
              type="text"
              value={importEditionInput}
              onChange={(event) => setImportEditionInput(event.target.value)}
              placeholder="Ex. city-jogging-2026"
              style={styles.input}
            />

            <button
              onClick={handleSaveImportEdition}
              disabled={loading}
              style={{
                ...styles.secondaryButton,
                ...(loading ? styles.disabledButton : {})
              }}
            >
              Enregistrer l'édition cible
            </button>
          </div>
        </div>

        <div style={styles.importBox}>
          <h2 style={styles.sectionTitle}>Import des pré-inscriptions</h2>
          <p style={styles.text}>
            Utilise ici l'export Miles. Les pré-inscrits seront importés dans{" "}
            <strong>{config.importTargetEdition}</strong> avec leur dossard
            initial si présent.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            style={styles.input}
          />

          <div style={styles.buttonRow}>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              style={{
                ...styles.primaryButton,
                ...((!file || loading) ? styles.disabledButton : {})
              }}
            >
              {loading ? "Traitement en cours..." : "Importer les pré-inscrits"}
            </button>

            <button
              onClick={handleDeleteImportedEdition}
              disabled={loading}
              style={{
                ...styles.deleteButton,
                ...(loading ? styles.disabledButton : {})
              }}
            >
              Supprimer l'import de cette édition
            </button>
          </div>
        </div>

        <div style={styles.notice}>
          Le bouton de bascule ne touche qu'à la configuration active. Les
          données 2025 et 2026 restent séparées dans Firestore via{" "}
          <code>eventEdition</code>.
        </div>

        {feedback && <div style={styles.feedback}>{feedback}</div>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f7fb",
    padding: "24px"
  },
  card: {
    width: "100%",
    maxWidth: "980px",
    background: "white",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    display: "grid",
    gap: "20px"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap"
  },
  title: {
    margin: 0,
    fontSize: "32px"
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px"
  },
  text: {
    margin: "8px 0 0 0",
    color: "#667085",
    lineHeight: 1.5
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px"
  },
  panel: {
    border: "1px solid #e4e7ec",
    borderRadius: "18px",
    padding: "20px",
    display: "grid",
    gap: "14px",
    background: "#fcfcfd"
  },
  panelLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#475467",
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  panelText: {
    margin: 0,
    color: "#667085",
    lineHeight: 1.5
  },
  badgePrimary: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#ecfdf3",
    color: "#027a48",
    fontWeight: 700,
    fontSize: "14px"
  },
  badgeSecondary: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    fontSize: "14px"
  },
  importBox: {
    border: "1px solid #e4e7ec",
    borderRadius: "18px",
    padding: "20px",
    display: "grid",
    gap: "14px"
  },
  input: {
    width: "100%",
    minHeight: "46px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid #d0d5dd",
    fontSize: "15px",
    boxSizing: "border-box"
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  primaryButton: {
    minHeight: "44px",
    padding: "0 16px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  secondaryButton: {
    minHeight: "44px",
    padding: "0 16px",
    border: "none",
    borderRadius: "10px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  deleteButton: {
    minHeight: "44px",
    padding: "0 16px",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    background: "#fef2f2",
    color: "#b42318",
    fontWeight: 700,
    cursor: "pointer"
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed"
  },
  backLink: {
    textDecoration: "none",
    background: "#111827",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 600,
    fontSize: "14px"
  },
  notice: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475467",
    borderRadius: "14px",
    padding: "14px 16px",
    lineHeight: 1.5
  },
  feedback: {
    borderRadius: "14px",
    padding: "14px 16px",
    background: "#eff8ff",
    border: "1px solid #b2ddff",
    color: "#175cd3",
    lineHeight: 1.5
  }
};

export default ConfigurationPage;
