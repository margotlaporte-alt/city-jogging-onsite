import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import {
  OWNER_EMAILS,
  ROLES,
  ROLE_LABELS,
  STAFF_ROLES_COLLECTION,
  normalizeEmail
} from "../config/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TeamPage() {
  const [members, setMembers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState(ROLES.GUICHET);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, STAFF_ROLES_COLLECTION),
      (snapshot) => {
        setMembers(
          snapshot.docs
            .map((item) => ({ email: item.id, ...item.data() }))
            .sort((left, right) => left.email.localeCompare(right.email))
        );
      },
      (error) => {
        console.error("Erreur chargement équipe :", error);
        setFeedback("Impossible de charger l'équipe.");
      }
    );

    return () => unsubscribe();
  }, []);

  const saveRole = async (email, role) => {
    await setDoc(doc(db, STAFF_ROLES_COLLECTION, email), {
      email,
      role,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || ""
    });
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const email = normalizeEmail(newEmail);

    if (!EMAIL_PATTERN.test(email)) {
      setFeedback("Adresse email invalide.");
      return;
    }

    if (OWNER_EMAILS.includes(email)) {
      setFeedback(`${email} est propriétaire : il est déjà admin.`);
      return;
    }

    setIsSaving(true);
    setFeedback("");

    try {
      await saveRole(email, newRole);
      setNewEmail("");
      setFeedback(`${email} a maintenant le rôle ${ROLE_LABELS[newRole]}.`);
    } catch (error) {
      console.error(error);
      setFeedback(`Erreur lors de l'enregistrement (${error?.code || "inconnue"}).`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeRole = async (email, role) => {
    setFeedback("");

    try {
      await saveRole(email, role);
      setFeedback(`${email} a maintenant le rôle ${ROLE_LABELS[role]}.`);
    } catch (error) {
      console.error(error);
      setFeedback(`Erreur lors de la modification (${error?.code || "inconnue"}).`);
    }
  };

  const handleRemove = async (email) => {
    const isSelf = normalizeEmail(auth.currentUser?.email) === email;
    const confirmed = window.confirm(
      isSelf
        ? "Retirer ton propre accès ? Tu ne pourras plus ouvrir le backoffice."
        : `Retirer l'accès de ${email} au backoffice ?`
    );

    if (!confirmed) return;

    setFeedback("");

    try {
      await deleteDoc(doc(db, STAFF_ROLES_COLLECTION, email));
      setFeedback(`${email} n'a plus accès au backoffice.`);
    } catch (error) {
      console.error(error);
      setFeedback(`Erreur lors du retrait (${error?.code || "inconnue"}).`);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Équipe</h1>
            <p style={styles.text}>
              Choisis qui peut ouvrir le backoffice. La personne se connecte avec son compte
              habituel ; son accès dépend de son email.
            </p>
          </div>

          <Link to="/guichet" style={styles.backLink}>
            Retour au guichet
          </Link>
        </div>

        <div style={styles.legend}>
          <div>
            <strong>Admin</strong> : guichet, statistiques, configuration et équipe.
          </div>
          <div>
            <strong>Guichet</strong> : guichet et statistiques.
          </div>
        </div>

        <form onSubmit={handleAdd} style={styles.addForm}>
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="prenom.nom@fla.lu"
            style={styles.input}
          />
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value)}
            style={styles.select}
          >
            <option value={ROLES.GUICHET}>{ROLE_LABELS[ROLES.GUICHET]}</option>
            <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
          </select>
          <button
            type="submit"
            disabled={isSaving || !newEmail.trim()}
            style={{
              ...styles.primaryButton,
              ...(isSaving || !newEmail.trim() ? styles.disabledButton : {})
            }}
          >
            Ajouter
          </button>
        </form>

        {feedback && <div style={styles.feedback}>{feedback}</div>}

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Rôle</th>
              <th style={styles.th}>Modifié</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {OWNER_EMAILS.map((email) => (
              <tr key={email}>
                <td style={styles.td}>{email}</td>
                <td style={styles.td}>Admin (propriétaire)</td>
                <td style={styles.tdMuted}>Défini dans le code</td>
                <td style={styles.td} />
              </tr>
            ))}

            {members
              .filter((member) => !OWNER_EMAILS.includes(member.email))
              .map((member) => (
                <tr key={member.email}>
                  <td style={styles.td}>{member.email}</td>
                  <td style={styles.td}>
                    <select
                      value={member.role}
                      onChange={(event) => handleChangeRole(member.email, event.target.value)}
                      style={styles.select}
                    >
                      <option value={ROLES.GUICHET}>{ROLE_LABELS[ROLES.GUICHET]}</option>
                      <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
                    </select>
                  </td>
                  <td style={styles.tdMuted}>
                    {member.updatedAt
                      ? `${new Date(member.updatedAt).toLocaleDateString("fr-LU")}${
                          member.updatedBy ? ` par ${member.updatedBy}` : ""
                        }`
                      : "—"}
                  </td>
                  <td style={styles.tdRight}>
                    <button onClick={() => handleRemove(member.email)} style={styles.removeButton}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <p style={styles.note}>
          Ajouter un email ne crée pas de compte : la personne doit déjà pouvoir se connecter
          (compte créé dans la console Firebase, ou plus tard via la connexion myFLA).
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "32px 16px"
  },
  card: {
    maxWidth: "960px",
    margin: "0 auto",
    background: "white",
    borderRadius: "20px",
    padding: "32px",
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
    fontSize: "34px"
  },
  text: {
    margin: "8px 0 0 0",
    color: "#667085",
    lineHeight: 1.5
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
  legend: {
    display: "grid",
    gap: "4px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #e4e7ec",
    fontSize: "14px",
    color: "#344054"
  },
  addForm: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  input: {
    flex: "1 1 260px",
    minHeight: "44px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid #d0d5dd",
    fontSize: "15px"
  },
  select: {
    minHeight: "40px",
    padding: "0 10px",
    borderRadius: "10px",
    border: "1px solid #d0d5dd",
    fontSize: "14px",
    background: "white"
  },
  primaryButton: {
    minHeight: "44px",
    padding: "0 18px",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed"
  },
  feedback: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#eff8ff",
    color: "#175cd3",
    border: "1px solid #b2ddff",
    fontSize: "14px"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px"
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #d0d5dd",
    color: "#475467",
    fontWeight: 600
  },
  td: {
    padding: "10px 8px",
    borderBottom: "1px solid #eaecf0",
    verticalAlign: "middle"
  },
  tdMuted: {
    padding: "10px 8px",
    borderBottom: "1px solid #eaecf0",
    color: "#667085",
    fontSize: "13px"
  },
  tdRight: {
    padding: "10px 8px",
    borderBottom: "1px solid #eaecf0",
    textAlign: "right"
  },
  removeButton: {
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b42318",
    fontWeight: 600,
    cursor: "pointer"
  },
  note: {
    margin: 0,
    fontSize: "13px",
    color: "#667085"
  }
};

export default TeamPage;
