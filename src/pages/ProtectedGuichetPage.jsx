import { useState } from "react";
import GuichetPage from "./GuichetPage";

const ORGANIZER_PASSWORD = "CityJogging2026";

function ProtectedGuichetPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("guichet-auth") === "true"
  );
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password === ORGANIZER_PASSWORD) {
      localStorage.setItem("guichet-auth", "true");
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Mot de passe incorrect.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("guichet-auth");
    setIsAuthenticated(false);
    setPassword("");
  };

  if (isAuthenticated) {
    return (
      <div>
        <div style={styles.topBar}>
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
        <p style={styles.subtitle}>Entrez le mot de passe pour accéder au guichet.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button}>
            Se connecter
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
    zIndex: 1000
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