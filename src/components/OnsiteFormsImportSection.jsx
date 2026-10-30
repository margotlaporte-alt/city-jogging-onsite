import { useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../services/firebase";
import {
  FORMS_EDITION,
  ROW_STATUS,
  analyzeFormsImport,
  buildFormsRegistration,
  formsRegistrationDocId,
  parseFormsRows
} from "../services/onsiteFormsImport";

const BATCH_SIZE = 400;

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function fullName(person) {
  return `${person.lastName || ""} ${person.firstName || ""}`.trim();
}

function describeExisting(registration) {
  const origin =
    registration.source === "online-import"
      ? "pré-inscrit Miles"
      : registration.source === "onsite-organizer"
        ? "saisi au stand"
        : "inscrit sur place";
  const bib = registration.bibNumber ? `, dossard ${registration.bibNumber}` : "";
  return `${fullName(registration)} (${origin}${bib}, né le ${formatDate(registration.birthDate)})`;
}

function OnsiteFormsImportSection({ styles }) {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [forcedIds, setForcedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setFeedback("");
    setAnalysis(null);
    setForcedIds(new Set());

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
        defval: ""
      });
      const snapshot = await getDocs(
        query(collection(db, "onsite_registrations"), where("eventEdition", "==", FORMS_EDITION))
      );
      const existing = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

      setAnalysis({
        ...analyzeFormsImport(parseFormsRows(rows), existing),
        existingCount: existing.length
      });
    } catch (error) {
      console.error(error);
      setFeedback("Erreur pendant l'analyse du fichier.");
    } finally {
      setLoading(false);
    }
  };

  const toggleForced = (formId) => {
    setForcedIds((previous) => {
      const next = new Set(previous);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  };

  const entriesToImport = analysis
    ? analysis.entries.filter(
        (entry) =>
          entry.status === ROW_STATUS.NEW ||
          (entry.status === ROW_STATUS.ALREADY_REGISTERED && forcedIds.has(entry.formId))
      )
    : [];

  const handleImport = async () => {
    if (entriesToImport.length === 0) return;

    const confirmed = window.confirm(
      `Importer ${entriesToImport.length} inscription(s) sur place dans ${FORMS_EDITION} ?`
    );

    if (!confirmed) return;

    setLoading(true);
    setFeedback("");

    try {
      const importedAt = new Date().toISOString();

      for (let start = 0; start < entriesToImport.length; start += BATCH_SIZE) {
        const batch = writeBatch(db);
        entriesToImport.slice(start, start + BATCH_SIZE).forEach((entry) => {
          batch.set(
            doc(db, "onsite_registrations", formsRegistrationDocId(entry)),
            buildFormsRegistration(entry, { fileName: file.name, importedAt }),
            { merge: true }
          );
        });
        await batch.commit();
      }

      setFeedback(
        `Import terminé : ${entriesToImport.length} inscription(s) sur place ajoutée(s) à ${FORMS_EDITION}.`
      );
      setAnalysis(null);
      setFile(null);
    } catch (error) {
      console.error(error);
      setFeedback(
        `Erreur pendant l'import (${error?.code || "inconnue"} : ${error?.message || ""}). Aucune donnée n'a été supprimée ; tu peux relancer l'import.`
      );
    } finally {
      setLoading(false);
    }
  };

  const listBy = (status) => analysis?.entries.filter((entry) => entry.status === status) || [];
  const alreadyRegistered = listBy(ROW_STATUS.ALREADY_REGISTERED);
  const duplicatesInFile = listBy(ROW_STATUS.DUPLICATE_IN_FILE);
  const setAside = [...listBy(ROW_STATUS.OUTSIDE_EVENT_DAY), ...listBy(ROW_STATUS.IGNORED_COURSE)];
  const missingBirthDate = listBy(ROW_STATUS.NEW).filter((entry) => !entry.birthDate).length;

  return (
    <div style={styles.importBox}>
      <h2 style={styles.sectionTitle}>Inscriptions sur place 2025 (formulaire QR code)</h2>
      <p style={styles.text}>
        Fichier Excel exporté de Microsoft Forms. Les inscriptions sont comparées par nom et
        prénom aux inscrits déjà présents dans <strong>{FORMS_EDITION}</strong> et entre elles,
        avant tout import.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(event) => {
          setFile(event.target.files?.[0] || null);
          setAnalysis(null);
        }}
        style={styles.input}
      />

      <div style={styles.buttonRow}>
        <button
          onClick={handleAnalyze}
          disabled={!file || loading}
          style={{ ...styles.secondaryButton, ...(!file || loading ? styles.disabledButton : {}) }}
        >
          {loading && !analysis ? "Analyse en cours..." : "Analyser le fichier"}
        </button>

        {analysis && (
          <button
            onClick={handleImport}
            disabled={loading || entriesToImport.length === 0}
            style={{
              ...styles.primaryButton,
              ...(loading || entriesToImport.length === 0 ? styles.disabledButton : {})
            }}
          >
            {loading ? "Import en cours..." : `Importer ${entriesToImport.length} inscription(s)`}
          </button>
        )}
      </div>

      {analysis && (
        <div style={local.summary}>
          <p style={styles.text}>
            Jour de l'événement détecté : <strong>{formatDate(analysis.eventDay)}</strong> ·{" "}
            {analysis.entries.length} ligne(s) dans le fichier · {analysis.existingCount} inscrit(s)
            déjà dans {FORMS_EDITION}.
          </p>
          <ul style={local.list}>
            <li>
              <strong>{analysis.counts[ROW_STATUS.NEW]}</strong> nouvelle(s) inscription(s) à importer
              {missingBirthDate > 0 &&
                ` (dont ${missingBirthDate} sans date de naissance exploitable, importées sans date)`}
            </li>
            <li>
              <strong>{alreadyRegistered.length}</strong> déjà inscrit(s) dans l'édition, non
              importé(s) par défaut
            </li>
            <li>
              <strong>{duplicatesInFile.length}</strong> doublon(s) dans le fichier, non importé(s)
            </li>
            <li>
              <strong>{setAside.length}</strong> ligne(s) écartée(s) (test hors jour J, garderie)
            </li>
          </ul>

          {alreadyRegistered.length > 0 && (
            <>
              <h3 style={local.subTitle}>Déjà inscrits dans {FORMS_EDITION}</h3>
              <p style={local.hint}>
                Coche une ligne seulement si c'est une autre personne qui porte le même nom.
              </p>
              <table style={local.table}>
                <thead>
                  <tr>
                    <th style={local.th}>Importer quand même</th>
                    <th style={local.th}>Formulaire sur place</th>
                    <th style={local.th}>Déjà inscrit</th>
                  </tr>
                </thead>
                <tbody>
                  {alreadyRegistered.map((entry) => (
                    <tr key={entry.formId}>
                      <td style={local.td}>
                        <input
                          type="checkbox"
                          checked={forcedIds.has(entry.formId)}
                          onChange={() => toggleForced(entry.formId)}
                        />
                      </td>
                      <td style={local.td}>
                        #{entry.formId} {fullName(entry)}, né le {formatDate(entry.birthDate)},{" "}
                        {entry.courseLabel}
                      </td>
                      <td style={local.td}>{describeExisting(entry.existingMatch)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {duplicatesInFile.length > 0 && (
            <>
              <h3 style={local.subTitle}>Doublons dans le fichier</h3>
              <table style={local.table}>
                <thead>
                  <tr>
                    <th style={local.th}>Ligne écartée</th>
                    <th style={local.th}>Ligne conservée</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicatesInFile.map((entry) => {
                    const keeper = analysis.entries.find((item) => item.formId === entry.duplicateOf);
                    return (
                      <tr key={entry.formId}>
                        <td style={local.td}>
                          #{entry.formId} {fullName(entry)}, né le {formatDate(entry.birthDateRaw)}
                        </td>
                        <td style={local.td}>
                          #{keeper.formId} {fullName(keeper)}, né le {formatDate(keeper.birthDateRaw)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {setAside.length > 0 && (
            <>
              <h3 style={local.subTitle}>Lignes écartées</h3>
              <ul style={local.list}>
                {setAside.map((entry) => (
                  <li key={entry.formId}>
                    #{entry.formId} {fullName(entry)} :{" "}
                    {entry.status === ROW_STATUS.OUTSIDE_EVENT_DAY
                      ? `envoyée le ${formatDate(entry.submittedOn)}, hors jour J`
                      : `course « ${entry.courseLabel} » non importée`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {feedback && <div style={styles.feedback}>{feedback}</div>}
    </div>
  );
}

const local = {
  summary: {
    marginTop: "16px",
    display: "grid",
    gap: "8px"
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    lineHeight: 1.6,
    fontSize: "14px"
  },
  subTitle: {
    margin: "12px 0 0 0",
    fontSize: "16px"
  },
  hint: {
    margin: 0,
    fontSize: "13px",
    color: "#667085"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px"
  },
  th: {
    textAlign: "left",
    padding: "8px",
    borderBottom: "1px solid #d0d5dd",
    color: "#475467"
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #eaecf0",
    verticalAlign: "top"
  }
};

export default OnsiteFormsImportSection;
