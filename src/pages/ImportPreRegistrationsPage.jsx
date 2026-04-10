import { useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { collection, doc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../services/firebase";

const ACTIVE_EVENT_EDITION = "city-jogging-2025";

function ImportPreRegistrationsPage() {
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

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
        const courseLabel = String(row["COURSE"] || "").trim();

        if (courseLabel === "Garderie") {
          skippedCount += 1;
          continue;
        }

        const courseData = mapCourse(courseLabel);

        if (!courseData) {
          skippedCount += 1;
          continue;
        }

        const externalId = String(row["ID"] || "").trim();
        if (!externalId) {
          skippedCount += 1;
          continue;
        }

        const birthDate = formatBirthDate(row["DATE DE NAISSANCE"]);
        const age = calculateAge(birthDate);
        const bib = normalizeBib(row["DOSSARD"]);

        const registrationCode = `PRE-${String(row["ÉDITION"] || "TEST")}-${String(
          importedCount + 1
        ).padStart(4, "0")}`;

        await setDoc(
          doc(db, "onsite_registrations", `prereg_${ACTIVE_EVENT_EDITION}_${externalId}`),
          {
            registrationCode,
            source: "online-import",
            isPreRegistered: true,
            preRegistrationBadge: "mail",
            externalRegistrationId: externalId,
            eventEdition: ACTIVE_EVENT_EDITION,

            lastName: String(row["NOM"] || "").trim(),
            firstName: String(row["PRÉNOM"] || "").trim(),
            email: String(row["COURRIEL"] || "").trim(),
            nationality: String(row["NATIONALITÉ"] || "").trim(),
            club: String(row["CLUB/ASSOCIATION"] || "").trim() || "Aucun club renseigné",
            sex: mapSex(row["GENRE"]),
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
        `Import terminé. ${importedCount} pré-inscrit(s) importé(s), ${skippedCount} ligne(s) ignorée(s).`
      );
    } catch (error) {
      console.error(error);
      setFeedback("Erreur pendant l'import.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImportedEdition = async () => {
    const confirmed = window.confirm(
      `Supprimer tous les inscrits de l'édition ${ACTIVE_EVENT_EDITION} ?`
    );

    if (!confirmed) return;

    setLoading(true);
    setFeedback("");

    try {
      const registrationsQuery = query(
        collection(db, "onsite_registrations"),
        where("eventEdition", "==", ACTIVE_EVENT_EDITION)
      );

      const snapshot = await getDocs(registrationsQuery);

      if (snapshot.empty) {
        setFeedback("Aucune donnée à supprimer pour cette édition.");
        setLoading(false);
        return;
      }

      const docs = snapshot.docs;
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
        `${docs.length} inscription(s) supprimée(s) pour ${ACTIVE_EVENT_EDITION}.`
      );
    } catch (error) {
      console.error(error);
      setFeedback("Erreur lors de la suppression de l'édition.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Import des pré-inscriptions</h1>
        <p style={styles.text}>
          Utilise ici l’export Miles. Les pré-inscrits recevront automatiquement
          la pastille enveloppe et leur dossard initial.
        </p>

        <div style={styles.badge}>Édition active : {ACTIVE_EVENT_EDITION}</div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          style={styles.input}
        />

        <button
          onClick={handleImport}
          disabled={!file || loading}
          style={{
            ...styles.primaryButton,
            ...((!file || loading) ? styles.disabledButton : {})
          }}
        >
          {loading ? "Import en cours..." : "Importer les pré-inscrits"}
        </button>

        <button
          onClick={handleDeleteImportedEdition}
          disabled={loading}
          style={{
            ...styles.deleteButton,
            ...(loading ? styles.disabledButton : {})
          }}
        >
          Supprimer toutes les données de cette édition
        </button>

        {feedback && <div style={styles.feedback}>{feedback}</div>}

        <Link to="/guichet" style={styles.backLink}>
          Retour au guichet
        </Link>
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
    maxWidth: "700px",
    background: "white",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    display: "grid",
    gap: "16px"
  },
  title: {
    margin: 0,
    fontSize: "28px"
  },
  text: {
    margin: 0,
    color: "#667085",
    lineHeight: 1.5
  },
  badge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    fontSize: "13px"
  },
  input: {
    height: "42px"
  },
  primaryButton: {
    height: "44px",
    border: "none",
    borderRadius: "10px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  deleteButton: {
    height: "44px",
    border: "none",
    borderRadius: "10px",
    background: "#dc2626",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed"
  },
  feedback: {
    padding: "12px 14px",
    borderRadius: "10px",
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 600
  },
  backLink: {
    color: "#4f46e5",
    textDecoration: "none",
    fontWeight: 600
  }
};

export default ImportPreRegistrationsPage;