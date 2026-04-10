import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../services/firebase";
import GuichetPage from "./GuichetPage";

function ProtectedGuichetPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError("Identifiants incorrects.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError("Erreur lors de la déconnexion.");
    }
  };

  if (isCheckingAuth) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.subtitle}>Vérification de la connexion...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div>
        <div style={styles.topBar}>
          <div style={styles.userInfo}>{user.email}</div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Déconnexion
          </button>
        </div>
        <GuichetPage />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Espace organisateur</h1>
        <p style={styles.subtitle}>
          Connectez-vous avec votre compte organisateur.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse email"
            style={styles.input}
            autoComplete="username"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            style={styles.input}
            autoComplete="current-password"
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button} disabled={isLoading}>
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
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
    maxWidth: "420px",
    background: "white",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "28px",
    textAlign: "center"
  },
  subtitle: {
    margin: "0 0 24px 0",
    textAlign: "center",
    color: "#667085"
  },
  form: {
    display: "grid",
    gap: "14px"
  },
  input: {
    height: "46px",
    padding: "0 14px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "15px"
  },
  button: {
    height: "46px",
    border: "none",
    borderRadius: "10px",
    background: "#4f46e5",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  },
  error: {
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px"
  },
  topBar: {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  userInfo: {
    background: "white",
    padding: "10px 12px",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: "14px"
  },
  logoutButton: {
    height: "40px",
    padding: "0 14px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "white",
    cursor: "pointer"
  }
};

export default ProtectedGuichetPage;