import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "../services/firebase";
import { nationalityOptions, clubsMain, clubsSecondary } from "../data/options";

const ACTIVE_EVENT_EDITION = "city-jogging-2025";

function GuichetPage() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("assign");
  const [registrations, setRegistrations] = useState([]);
  const [reassignMode, setReassignMode] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [bibInputs, setBibInputs] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [sexFilter, setSexFilter] = useState("all");

  const [newForm, setNewForm] = useState({
    lastName: "",
    firstName: "",
    email: "",
    nationality: "",
    club: "Aucun club renseigné",
    sex: "",
    birthDate: "",
    legalGuardian: "",
    participationType: "run",
    distance: "6km",
    bibNumber: "",
    dataConsent: true,
    futureContactConsent: false
  });

  const [createFormError, setCreateFormError] = useState("");

  useEffect(() => {
    const registrationsQuery = query(
      collection(db, "onsite_registrations"),
      where("eventEdition", "==", ACTIVE_EVENT_EDITION),
      orderBy("registrationCode", "desc")
    );

    const unsubscribe = onSnapshot(registrationsQuery, (snapshot) => {
      const data = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }));
      setRegistrations(data);
    });

    return () => unsubscribe();
  }, []);

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

  const createAge = calculateAge(newForm.birthDate);
  const createIsMinor = createAge !== null && createAge < 18;
  const createIsUnderFive = createAge !== null && createAge < 5;
  const createIsKidsJogging = newForm.participationType === "kids_jogging";

  useEffect(() => {
    if (newForm.participationType === "kids_jogging") {
      setNewForm((prev) => ({
        ...prev,
        distance: "1km"
      }));
    }
  }, [newForm.participationType]);

  useEffect(() => {
    if (!newForm.birthDate) {
      setCreateFormError("");
      return;
    }

    if (createIsUnderFive) {
      setCreateFormError(
        "Les inscriptions sont interdites pour les enfants de moins de 5 ans."
      );
      return;
    }

    if (createIsKidsJogging && (createAge < 5 || createAge > 14)) {
      setCreateFormError(
        "Le Kids Jogging est réservé aux enfants de 5 à 14 ans."
      );
      return;
    }

    setCreateFormError("");
  }, [
    newForm.birthDate,
    newForm.participationType,
    createAge,
    createIsKidsJogging,
    createIsUnderFive
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

  const filteredAssignableRegistrations = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return registrations.filter(
        (item) => !item.bibAssigned && !item.isPreRegistered
      );
    }

    return registrations.filter((item) => {
      const code = (item.registrationCode || "").toLowerCase();
      const lastName = (item.lastName || "").toLowerCase();
      const firstName = (item.firstName || "").toLowerCase();
      const bib = String(item.bibNumber || "").toLowerCase();

      return (
        code.includes(normalized) ||
        lastName.includes(normalized) ||
        firstName.includes(normalized) ||
        bib.includes(normalized)
      );
    });
  }, [registrations, searchTerm]);

  const filteredAllRegistrations = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return registrations.filter((item) => {
      const code = (item.registrationCode || "").toLowerCase();
      const lastName = (item.lastName || "").toLowerCase();
      const firstName = (item.firstName || "").toLowerCase();
      const bib = String(item.bibNumber || "").toLowerCase();

      const matchesSearch =
        !normalized ||
        code.includes(normalized) ||
        lastName.includes(normalized) ||
        firstName.includes(normalized) ||
        bib.includes(normalized);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" &&
          !item.bibAssigned &&
          !item.isPreRegistered) ||
        (statusFilter === "assigned" &&
          item.bibAssigned &&
          !item.isPreRegistered) ||
        (statusFilter === "pre-registered" && item.isPreRegistered) ||
        (statusFilter === "reissued" && item.status === "reissued");

      const matchesType =
        typeFilter === "all" || item.participationType === typeFilter;

      const matchesDistance =
        distanceFilter === "all" || item.distance === distanceFilter;

      const matchesSex = sexFilter === "all" || item.sex === sexFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDistance &&
        matchesSex
      );
    });
  }, [
    registrations,
    searchTerm,
    statusFilter,
    typeFilter,
    distanceFilter,
    sexFilter
  ]);

  const handleBibInputChange = (registrationId, value) => {
    setBibInputs((prev) => ({
      ...prev,
      [registrationId]: value
    }));
  };

  const handleAssignBib = async (registration) => {
    const bibNumber = (bibInputs[registration.id] || "").trim();

    if (!bibNumber) {
      setFeedbackMessage("Merci de saisir un numéro de dossard.");
      return;
    }

    const existingBib = registrations.find(
      (item) =>
        item.id !== registration.id &&
        String(item.bibNumber || "").trim() === bibNumber
    );

    if (existingBib) {
      setFeedbackMessage(
        `Le dossard ${bibNumber} est déjà attribué à ${existingBib.firstName} ${existingBib.lastName}.`
      );
      return;
    }

    try {
      const previousBib = String(registration.bibNumber || "").trim();

      const historyEntry =
        previousBib && previousBib !== bibNumber
          ? {
              oldBibNumber: previousBib,
              newBibNumber: bibNumber,
              changedAt: new Date().toISOString(),
              reason: registration.isPreRegistered
                ? "replacement-for-pre-registration"
                : "manual-reassignment"
            }
          : null;

      await updateDoc(doc(db, "onsite_registrations", registration.id), {
        bibNumber,
        bibAssigned: true,
        status: registration.isPreRegistered
          ? previousBib && previousBib !== bibNumber
            ? "reissued"
            : "pre-registered"
          : "collected",
        bibReassigned: previousBib !== "" && previousBib !== bibNumber,
        bibHistory: historyEntry
          ? [...(registration.bibHistory || []), historyEntry]
          : registration.bibHistory || [],
        lastBibChangeAt: new Date().toISOString()
      });

      setBibInputs((prev) => ({
        ...prev,
        [registration.id]: ""
      }));

      setReassignMode((prev) => ({
        ...prev,
        [registration.id]: false
      }));

      if (previousBib && previousBib !== bibNumber) {
        setFeedbackMessage(
          `Dossard modifié pour ${registration.firstName} ${registration.lastName} : ${previousBib} → ${bibNumber}.`
        );
      } else {
        setFeedbackMessage(
          `Dossard ${bibNumber} attribué à ${registration.firstName} ${registration.lastName}.`
        );
      }
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Erreur lors de l'attribution du dossard.");
    }
  };

  const handleDeleteRegistration = async (registrationId, registrationCode) => {
    const confirmed = window.confirm(
      `Supprimer l'inscription ${registrationCode} ?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "onsite_registrations", registrationId));
      setFeedbackMessage(`Inscription ${registrationCode} supprimée.`);
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Erreur lors de la suppression.");
    }
  };

  const handleNewFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setNewForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleNewClubFocus = () => {
    if (newForm.club === "Aucun club renseigné") {
      setNewForm((prev) => ({
        ...prev,
        club: ""
      }));
    }
  };

  const handleNewClubBlur = () => {
    if (newForm.club.trim() === "") {
      setNewForm((prev) => ({
        ...prev,
        club: "Aucun club renseigné"
      }));
    }
  };

  const isNewRegistrationValid =
    newForm.lastName.trim() !== "" &&
    newForm.firstName.trim() !== "" &&
    newForm.nationality.trim() !== "" &&
    newForm.sex.trim() !== "" &&
    newForm.birthDate.trim() !== "" &&
    newForm.participationType.trim() !== "" &&
    newForm.distance.trim() !== "" &&
    (!createIsMinor || newForm.legalGuardian.trim() !== "") &&
    !createFormError &&
    newForm.bibNumber.trim() !== "";

  const handleCreateWithBib = async (event) => {
    event.preventDefault();

    if (!isNewRegistrationValid) {
      setFeedbackMessage("Merci de compléter tous les champs obligatoires.");
      return;
    }

    const existingBib = registrations.find(
      (item) => String(item.bibNumber || "").trim() === newForm.bibNumber.trim()
    );

    if (existingBib) {
      setFeedbackMessage(
        `Le dossard ${newForm.bibNumber.trim()} est déjà attribué.`
      );
      return;
    }

    try {
      const newCode = await generateCode();

      await addDoc(collection(db, "onsite_registrations"), {
        registrationCode: newCode,
        lastName: newForm.lastName.trim(),
        firstName: newForm.firstName.trim(),
        email: newForm.email.trim(),
        nationality: newForm.nationality.trim(),
        club:
          newForm.club.trim() === ""
            ? "Aucun club renseigné"
            : newForm.club.trim(),
        sex: newForm.sex,
        birthDate: newForm.birthDate,
        age: createAge,
        legalGuardian: createIsMinor ? newForm.legalGuardian.trim() : "",
        participationType: newForm.participationType,
        distance: newForm.distance,
        dataConsent: newForm.dataConsent,
        futureContactConsent: newForm.futureContactConsent,
        bibNumber: newForm.bibNumber.trim(),
        originalBibNumber: newForm.bibNumber.trim(),
        bibAssigned: true,
        status: "collected",
        source: "onsite-organizer",
        eventEdition: ACTIVE_EVENT_EDITION,
        isPreRegistered: false,
        bibReassigned: false,
        bibHistory: [],
        createdAt: new Date().toISOString()
      });

      setNewForm({
        lastName: "",
        firstName: "",
        email: "",
        nationality: "",
        club: "Aucun club renseigné",
        sex: "",
        birthDate: "",
        legalGuardian: "",
        participationType: "run",
        distance: "6km",
        bibNumber: "",
        dataConsent: true,
        futureContactConsent: false
      });

      setCreateFormError("");
      setFeedbackMessage(`Inscription créée avec succès. Code : ${newCode}`);
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Erreur lors de la création de l'inscription.");
    }
  };

  const exportToCsv = () => {
    const headers = [
      "Code",
      "Pré-inscription",
      "Nom",
      "Prénom",
      "Email",
      "Nationalité",
      "Club",
      "Sexe",
      "Date de naissance",
      "Âge",
      "Responsable légal",
      "Type",
      "Distance",
      "Dossard actuel",
      "Dossard initial",
      "Statut"
    ];

    const rows = filteredAllRegistrations.map((item) => [
      item.registrationCode || "",
      item.isPreRegistered ? "Oui" : "Non",
      item.lastName || "",
      item.firstName || "",
      item.email || "",
      item.nationality || "",
      item.club || "",
      item.sex || "",
      item.birthDate || "",
      item.age ?? "",
      item.legalGuardian || "",
      item.participationType || "",
      item.distance || "",
      item.bibNumber || "",
      item.originalBibNumber || "",
      item.isPreRegistered
        ? item.status === "reissued"
          ? "Pré-inscrit / dossard remplacé"
          : "Pré-inscrit"
        : item.bibAssigned
        ? "Dossard attribué"
        : "En attente"
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `city-jogging-${ACTIVE_EVENT_EDITION}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPreRegistrationBadge = (registration) => {
    if (!registration.isPreRegistered) return null;

    return (
      <span
        title="Pré-inscription avec dossard envoyé par courrier"
        style={styles.mailBadge}
      >
        ✉
      </span>
    );
  };

  const getReadableType = (registration) => {
    return registration.participationType === "run"
      ? "Course"
      : registration.participationType === "nordic_walk"
      ? "Marche nordique"
      : "Kids Jogging";
  };

  const getReadableStatus = (registration) => {
    if (registration.isPreRegistered) {
      if (registration.status === "reissued") {
        return "Pré-inscrit / dossard remplacé";
      }
      return "Pré-inscrit";
    }

    return registration.bibAssigned ? "Dossard attribué" : "En attente";
  };

  const getBibConflict = (registration, bibValue) => {
    const normalizedBib = String(bibValue || "").trim();

    if (!normalizedBib) return null;

    return registrations.find(
      (item) =>
        item.id !== registration.id &&
        String(item.bibNumber || "").trim() === normalizedBib
    );
  };

  const renderAssignView = () => (
    <>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Recherche et gestion des dossards</h2>
        <p style={styles.sectionText}>
          Sans recherche : seuls les inscrits à traiter apparaissent. Avec une
          recherche : les pré-inscrits sont aussi retrouvables.
        </p>
      </div>

      <input
        type="text"
        placeholder="Rechercher par code, nom, prénom ou dossard"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        style={styles.searchBar}
      />

      <div style={styles.counterBox}>
        {searchTerm.trim()
          ? `${filteredAssignableRegistrations.length} résultat(s)`
          : `${filteredAssignableRegistrations.length} inscrit(s) à traiter`}
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.stickyCol1, zIndex: 50 }}>
                Code
              </th>
              <th style={{ ...styles.th, ...styles.stickyCol2, zIndex: 50 }}>
                Nom
              </th>
              <th style={{ ...styles.th, ...styles.stickyCol3, zIndex: 50 }}>
                Prénom
              </th>
              <th style={styles.th}>Sexe</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Distance</th>
              <th style={styles.th}>Statut</th>
              <th style={styles.th}>Dossard actuel</th>
              <th
                style={{
                  ...styles.th,
                  ...styles.stickyRightAction,
                  zIndex: 50
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignableRegistrations.length === 0 ? (
              <tr>
                <td colSpan="9" style={styles.emptyCell}>
                  Aucun inscrit trouvé.
                </td>
              </tr>
            ) : (
              filteredAssignableRegistrations.map((registration) => {
                const currentInput = bibInputs[registration.id] || "";
                const bibConflict = getBibConflict(registration, currentInput);

                return (
                  <tr key={registration.id}>
                    <td style={{ ...styles.td, ...styles.stickyCol1 }}>
                      {registration.registrationCode}
                    </td>

                    <td style={{ ...styles.td, ...styles.stickyCol2 }}>
                      <div style={styles.nameCell}>
                        <span>{registration.lastName}</span>
                        {renderPreRegistrationBadge(registration)}
                      </div>
                    </td>

                    <td style={{ ...styles.td, ...styles.stickyCol3 }}>
                      {registration.firstName}
                    </td>

                    <td style={styles.td}>
                      {registration.sex === "male"
                        ? "Homme"
                        : registration.sex === "female"
                        ? "Femme"
                        : "-"}
                    </td>

                    <td style={styles.td}>{getReadableType(registration)}</td>
                    <td style={styles.td}>{registration.distance}</td>
                    <td style={styles.td}>{getReadableStatus(registration)}</td>

                    <td style={styles.td}>
                      {registration.bibNumber ? registration.bibNumber : "-"}
                      {registration.isPreRegistered &&
                        registration.originalBibNumber &&
                        registration.status !== "reissued" && (
                          <span style={styles.smallMutedText}>
                            Envoyé par courrier
                          </span>
                        )}
                      {registration.isPreRegistered &&
                        registration.originalBibNumber &&
                        registration.status === "reissued" && (
                          <span style={styles.smallMutedText}>
                            Initial : {registration.originalBibNumber}
                          </span>
                        )}
                    </td>

                    <td style={{ ...styles.td, ...styles.stickyRightAction }}>
                      {!registration.bibAssigned ? (
                        <div style={styles.reassignBox}>
                          <input
                            type="text"
                            placeholder="N° dossard"
                            value={currentInput}
                            onChange={(event) =>
                              handleBibInputChange(
                                registration.id,
                                event.target.value
                              )
                            }
                            style={{
                              ...styles.bibInput,
                              ...(bibConflict ? styles.bibInputError : {})
                            }}
                          />

                          {bibConflict && (
                            <div style={styles.liveWarning}>
                              Dossard déjà attribué à {bibConflict.firstName}{" "}
                              {bibConflict.lastName}
                            </div>
                          )}

                          <button
                            style={{
                              ...styles.actionButton,
                              ...(bibConflict ? styles.disabledButton : {})
                            }}
                            onClick={() => handleAssignBib(registration)}
                            disabled={!!bibConflict}
                          >
                            Valider
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            style={styles.actionButton}
                            onClick={() =>
                              setReassignMode((prev) => ({
                                ...prev,
                                [registration.id]: !prev[registration.id]
                              }))
                            }
                          >
                            {reassignMode[registration.id]
                              ? "Annuler"
                              : "Réattribuer"}
                          </button>

                          {reassignMode[registration.id] && (
                            <div style={styles.reassignBox}>
                              <input
                                type="text"
                                placeholder="Nouveau dossard"
                                value={currentInput}
                                onChange={(event) =>
                                  handleBibInputChange(
                                    registration.id,
                                    event.target.value
                                  )
                                }
                                style={{
                                  ...styles.bibInput,
                                  ...(bibConflict ? styles.bibInputError : {})
                                }}
                              />

                              {bibConflict && (
                                <div style={styles.liveWarning}>
                                  Dossard déjà attribué à {bibConflict.firstName}{" "}
                                  {bibConflict.lastName}
                                </div>
                              )}

                              <button
                                style={{
                                  ...styles.confirmButton,
                                  ...(bibConflict ? styles.disabledButton : {})
                                }}
                                onClick={() => handleAssignBib(registration)}
                                disabled={!!bibConflict}
                              >
                                Confirmer
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderCreateView = () => (
    <>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Inscription avec attribution directe</h2>
        <p style={styles.sectionText}>
          Encodage manuel d’un participant avec attribution immédiate du
          dossard.
        </p>
      </div>

      <form onSubmit={handleCreateWithBib} style={styles.formGrid}>
        <input
          name="lastName"
          value={newForm.lastName}
          onChange={handleNewFormChange}
          placeholder="Nom *"
          style={styles.input}
          required
        />

        <input
          name="firstName"
          value={newForm.firstName}
          onChange={handleNewFormChange}
          placeholder="Prénom *"
          style={styles.input}
          required
        />

        <input
          name="email"
          type="email"
          value={newForm.email}
          onChange={handleNewFormChange}
          placeholder="Adresse mail"
          style={styles.input}
        />

        <input
          name="nationality"
          list="guichet-nationalities"
          value={newForm.nationality}
          onChange={handleNewFormChange}
          placeholder="Nationalité *"
          style={styles.input}
          required
        />
        <datalist id="guichet-nationalities">
          {nationalityOptions.fr.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <input
          name="club"
          list="guichet-clubs"
          value={newForm.club}
          onChange={handleNewFormChange}
          onFocus={handleNewClubFocus}
          onBlur={handleNewClubBlur}
          placeholder="Club"
          style={styles.input}
        />
        <datalist id="guichet-clubs">
          {[...clubsMain, ...clubsSecondary].map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <select
          name="sex"
          value={newForm.sex}
          onChange={handleNewFormChange}
          style={styles.input}
        >
          <option value="">Sexe *</option>
          <option value="male">Homme</option>
          <option value="female">Femme</option>
        </select>

        <input
          name="birthDate"
          type="date"
          value={newForm.birthDate}
          onChange={handleNewFormChange}
          style={styles.input}
          required
        />

        <select
          name="participationType"
          value={newForm.participationType}
          onChange={handleNewFormChange}
          style={styles.input}
        >
          <option value="run">Course</option>
          <option value="nordic_walk">Marche nordique</option>
          <option value="kids_jogging">Kids Jogging</option>
        </select>

        <select
          name="distance"
          value={newForm.distance}
          onChange={handleNewFormChange}
          style={styles.input}
          disabled={createIsKidsJogging}
        >
          {createIsKidsJogging ? (
            <option value="1km">1 km</option>
          ) : (
            <>
              <option value="6km">6 km</option>
              <option value="10km">10 km</option>
            </>
          )}
        </select>

        {createIsMinor && (
          <input
            name="legalGuardian"
            value={newForm.legalGuardian}
            onChange={handleNewFormChange}
            placeholder="Responsable légal *"
            style={styles.input}
            required
          />
        )}

        <input
          name="bibNumber"
          value={newForm.bibNumber}
          onChange={handleNewFormChange}
          placeholder="Numéro de dossard *"
          style={styles.input}
          required
        />

        {createFormError && (
          <div style={styles.errorBox}>{createFormError}</div>
        )}

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            name="dataConsent"
            checked={newForm.dataConsent}
            onChange={handleNewFormChange}
          />
          <span>Données autorisées dans le cadre de la course</span>
        </label>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            name="futureContactConsent"
            checked={newForm.futureContactConsent}
            onChange={handleNewFormChange}
          />
          <span>Autorise la FLA à recontacter pour les éditions futures</span>
        </label>

        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            ...(!isNewRegistrationValid ? styles.disabledButton : {})
          }}
          disabled={!isNewRegistrationValid}
        >
          Créer l’inscription et attribuer le dossard
        </button>
      </form>
    </>
  );

  const renderAllView = () => (
    <>
      <div style={styles.allViewTop}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Tous les inscrits</h2>
          <p style={styles.sectionText}>
            Vue complète des inscriptions avec leur statut et leur numéro de
            dossard.
          </p>
        </div>

        <div style={styles.searchExportRow}>
          <input
            type="text"
            placeholder="Rechercher par code, nom, prénom ou dossard"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={styles.searchBar}
          />

          <button style={styles.exportButtonTop} onClick={exportToCsv}>
            Export CSV
          </button>
        </div>

        <div style={styles.filtersRow}>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={styles.compactInput}
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="assigned">Dossard attribué</option>
            <option value="pre-registered">Pré-inscrit</option>
            <option value="reissued">Dossard remplacé</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            style={styles.compactInput}
          >
            <option value="all">Tous les types</option>
            <option value="run">Course</option>
            <option value="nordic_walk">Marche nordique</option>
            <option value="kids_jogging">Kids Jogging</option>
          </select>

          <select
            value={distanceFilter}
            onChange={(event) => setDistanceFilter(event.target.value)}
            style={styles.compactInput}
          >
            <option value="all">Toutes les distances</option>
            <option value="1km">1 km</option>
            <option value="6km">6 km</option>
            <option value="10km">10 km</option>
          </select>

          <select
            value={sexFilter}
            onChange={(event) => setSexFilter(event.target.value)}
            style={styles.compactInput}
          >
            <option value="all">Tous les sexes</option>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
          </select>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.stickyCol1, zIndex: 50 }}>
                Code
              </th>
              <th style={{ ...styles.th, ...styles.stickyCol2, zIndex: 50 }}>
                Nom
              </th>
              <th style={{ ...styles.th, ...styles.stickyCol3, zIndex: 50 }}>
                Prénom
              </th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Nationalité</th>
              <th style={styles.th}>Club</th>
              <th style={styles.th}>Sexe</th>
              <th style={styles.th}>Naissance</th>
              <th style={styles.th}>Âge</th>
              <th style={styles.th}>Resp. légal</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Distance</th>
              <th style={styles.th}>Dossard actuel</th>
              <th style={styles.th}>Dossard initial</th>
              <th style={styles.th}>Statut</th>
              <th
                style={{
                  ...styles.th,
                  ...styles.stickyRightDelete,
                  zIndex: 50
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAllRegistrations.length === 0 ? (
              <tr>
                <td colSpan="16" style={styles.emptyCell}>
                  Aucun inscrit trouvé.
                </td>
              </tr>
            ) : (
              filteredAllRegistrations.map((registration) => (
                <tr key={registration.id}>
                  <td style={{ ...styles.td, ...styles.stickyCol1 }}>
                    {registration.registrationCode}
                  </td>

                  <td style={{ ...styles.td, ...styles.stickyCol2 }}>
                    <div style={styles.nameCell}>
                      <span>{registration.lastName}</span>
                      {renderPreRegistrationBadge(registration)}
                    </div>
                  </td>

                  <td style={{ ...styles.td, ...styles.stickyCol3 }}>
                    {registration.firstName}
                  </td>

                  <td style={styles.td}>{registration.email || "-"}</td>
                  <td style={styles.td}>{registration.nationality || "-"}</td>
                  <td style={styles.td}>{registration.club || "-"}</td>

                  <td style={styles.td}>
                    {registration.sex === "male"
                      ? "Homme"
                      : registration.sex === "female"
                      ? "Femme"
                      : "-"}
                  </td>

                  <td style={styles.td}>{registration.birthDate || "-"}</td>
                  <td style={styles.td}>
                    {registration.age !== undefined && registration.age !== null
                      ? registration.age
                      : "-"}
                  </td>
                  <td style={styles.td}>{registration.legalGuardian || "-"}</td>

                  <td style={styles.td}>{getReadableType(registration)}</td>
                  <td style={styles.td}>{registration.distance || "-"}</td>
                  <td style={styles.td}>{registration.bibNumber || "-"}</td>
                  <td style={styles.td}>
                    {registration.originalBibNumber || "-"}
                  </td>
                  <td style={styles.td}>{getReadableStatus(registration)}</td>

                  <td style={{ ...styles.td, ...styles.stickyRightDelete }}>
                    <button
                      style={styles.deleteButton}
                      onClick={() =>
                        handleDeleteRegistration(
                          registration.id,
                          registration.registrationCode
                        )
                      }
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <aside style={styles.sidebar}>
          <div>
            <h1 style={styles.sidebarTitle}>Espace organisateur</h1>
            <p style={styles.sidebarText}>
              Gestion des inscriptions et dossards
            </p>
            <p style={styles.sidebarEdition}>
              Édition active : {ACTIVE_EVENT_EDITION}
            </p>
          </div>

          <div style={styles.menu}>
            <button
              style={{
                ...styles.menuButton,
                ...(activeView === "assign" ? styles.menuButtonActive : {})
              }}
              onClick={() => setActiveView("assign")}
            >
              Recherche / dossards
            </button>

            <button
              style={{
                ...styles.menuButton,
                ...(activeView === "create" ? styles.menuButtonActive : {})
              }}
              onClick={() => setActiveView("create")}
            >
              Inscription + dossard
            </button>

            <button
              style={{
                ...styles.menuButton,
                ...(activeView === "all" ? styles.menuButtonActive : {})
              }}
              onClick={() => setActiveView("all")}
            >
              Tous les inscrits
            </button>

            <button
              style={styles.menuButton}
              onClick={() => navigate("/import-preinscrits")}
            >
              Import pré-inscrits
            </button>

            <button
              style={styles.menuButton}
              onClick={() => navigate("/stats")}
            >
              Statistiques
            </button>
          </div>

          <div style={styles.sidebarFooter}>
            <Link to="/" style={styles.backLink}>
              Retour au formulaire public
            </Link>
          </div>
        </aside>

        <main style={styles.content}>
          {feedbackMessage && (
            <div style={styles.feedback}>{feedbackMessage}</div>
          )}

          {activeView === "assign" && renderAssignView()}
          {activeView === "create" && renderCreateView()}
          {activeView === "all" && renderAllView()}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "20px"
  },
  shell: {
    maxWidth: "1600px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "20px"
  },
  allViewTop: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "white",
    paddingBottom: "12px"
  },
  sidebar: {
    background: "white",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "calc(100vh - 40px)"
  },
  sidebarTitle: {
    margin: 0,
    fontSize: "24px",
    lineHeight: "1.2",
    wordBreak: "break-word"
  },
  sidebarText: {
    marginTop: "8px",
    color: "#667085",
    lineHeight: "1.4",
    fontSize: "14px"
  },
  sidebarEdition: {
    marginTop: "10px",
    color: "#3730a3",
    fontWeight: 700,
    fontSize: "13px"
  },
  menu: {
    display: "grid",
    gap: "10px",
    marginTop: "24px"
  },
  menuButton: {
    height: "44px",
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "10px",
    textAlign: "left",
    padding: "0 14px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px"
  },
  menuButtonActive: {
    background: "#4f46e5",
    color: "white",
    border: "1px solid #4f46e5"
  },
  sidebarFooter: {
    marginTop: "24px"
  },
  backLink: {
    color: "#4f46e5",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "14px"
  },
  content: {
    background: "white",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    minWidth: 0
  },
  sectionHeader: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    lineHeight: "1.2",
    wordBreak: "break-word"
  },
  sectionText: {
    margin: 0,
    color: "#667085",
    lineHeight: "1.4",
    wordBreak: "break-word",
    fontSize: "14px"
  },
  input: {
    height: "42px",
    padding: "0 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box"
  },
  compactInput: {
    height: "42px",
    padding: "0 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    minWidth: "160px"
  },
  searchBar: {
    height: "42px",
    padding: "0 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0
  },
  searchExportRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 180px",
    gap: "12px",
    alignItems: "center",
    marginBottom: "12px"
  },
  filtersRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "16px"
  },
  bibInput: {
    height: "36px",
    padding: "0 10px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "13px",
    marginTop: "6px"
  },
  primaryButton: {
    height: "46px",
    border: "none",
    borderRadius: "10px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "8px"
  },
  actionButton: {
    height: "36px",
    border: "none",
    borderRadius: "8px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 600,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: "13px"
  },
  confirmButton: {
    height: "36px",
    border: "none",
    borderRadius: "8px",
    background: "#f97316",
    color: "white",
    fontWeight: 600,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: "13px"
  },
  deleteButton: {
    height: "34px",
    border: "none",
    borderRadius: "8px",
    background: "#dc2626",
    color: "white",
    fontWeight: 600,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: "13px"
  },
  exportButtonTop: {
    height: "42px",
    border: "none",
    borderRadius: "10px",
    background: "#16a34a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    fontSize: "14px"
  },
  disabledButton: {
    background: "#c7c9d9",
    cursor: "not-allowed"
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "14px",
    lineHeight: "1.5",
    color: "#344054"
  },
  formGrid: {
    display: "grid",
    gap: "12px"
  },
  feedback: {
    marginBottom: "16px",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 600,
    fontSize: "14px"
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px"
  },
  counterBox: {
    marginTop: "12px",
    marginBottom: "14px",
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    fontSize: "13px"
  },
  tableWrapper: {
    overflowX: "auto",
    overflowY: "auto",
    marginTop: "8px",
    border: "1px solid #e4e7ec",
    borderRadius: "12px",
    maxHeight: "65vh",
    position: "relative"
  },
  table: {
    width: "max-content",
    minWidth: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "auto"
  },
  th: {
    textAlign: "center",
    padding: "8px 8px",
    borderBottom: "1px solid #e4e7ec",
    fontSize: "12px",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
    background: "white",
    position: "sticky",
    top: 0,
    zIndex: 30
  },
  td: {
    padding: "8px 8px",
    borderBottom: "1px solid #f2f4f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    background: "white",
    fontSize: "13px",
    textAlign: "center"
  },
  stickyCol1: {
    position: "sticky",
    left: 0,
    background: "white",
    zIndex: 7,
    minWidth: "88px",
    maxWidth: "88px",
    boxShadow: "2px 0 4px rgba(0,0,0,0.04)"
  },
  stickyCol2: {
    position: "sticky",
    left: "88px",
    background: "white",
    zIndex: 7,
    minWidth: "120px",
    maxWidth: "120px"
  },
  stickyCol3: {
    position: "sticky",
    left: "208px",
    background: "white",
    zIndex: 7,
    minWidth: "120px",
    maxWidth: "120px",
    boxShadow: "2px 0 4px rgba(0,0,0,0.04)"
  },
  stickyRightAction: {
    position: "sticky",
    right: 0,
    background: "white",
    zIndex: 7,
    minWidth: "190px",
    boxShadow: "-2px 0 4px rgba(0,0,0,0.04)"
  },
  stickyRightDelete: {
    position: "sticky",
    right: 0,
    background: "white",
    zIndex: 7,
    minWidth: "120px",
    boxShadow: "-2px 0 4px rgba(0,0,0,0.04)"
  },
  emptyCell: {
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    fontSize: "14px"
  },
  mailBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    background: "#fff7ed",
    color: "#ea580c",
    fontSize: "11px",
    fontWeight: 700,
    border: "1px solid #fdba74",
    marginLeft: "6px",
    verticalAlign: "middle"
  },
  nameCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px"
  },
  smallMutedText: {
    display: "block",
    fontSize: "11px",
    color: "#667085",
    marginTop: "2px"
  },
  reassignBox: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "170px"
  },
  liveWarning: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "8px 10px",
    fontSize: "12px",
    lineHeight: "1.35",
    whiteSpace: "normal",
    textAlign: "left"
  },
  bibInputError: {
    border: "1px solid #ef4444",
    background: "#fff5f5"
  }
};

export default GuichetPage;