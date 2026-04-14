import React from "react";
import { Link } from "react-router-dom";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Erreur inconnue"
    };
  }

  componentDidCatch(error) {
    console.error("Erreur interface :", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Une erreur est survenue</h1>
          <p style={styles.text}>
            L'écran n'a pas pu s'afficher correctement. Tu peux revenir au
            guichet puis réessayer.
          </p>
          <div style={styles.errorBox}>{this.state.errorMessage}</div>
          <div style={styles.actions}>
            <Link to="/guichet" style={styles.linkButton}>
              Retour au guichet
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={styles.button}
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
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
    maxWidth: "520px",
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
  errorBox: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#fef2f2",
    color: "#b42318",
    border: "1px solid #fecaca",
    fontFamily: "monospace",
    fontSize: "13px"
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  linkButton: {
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "10px",
    background: "#111827",
    color: "white",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700
  },
  button: {
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer"
  }
};

export default ErrorBoundary;
