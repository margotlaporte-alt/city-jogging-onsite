import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../services/firebase";
import {
  DEFAULT_APP_CONFIG,
  getEditionYear,
  loadAppConfig
} from "../services/appConfig";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from "recharts";

function StatsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [activeEdition, setActiveEdition] = useState(
    DEFAULT_APP_CONFIG.onsiteActiveEdition
  );
  const editionYear = getEditionYear(activeEdition);

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
        console.error("Erreur chargement edition stats :", error);
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "onsite_registrations"),
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((registration) => registration.eventEdition === activeEdition);
        setRegistrations(data);
      }
    );

    return () => unsubscribe();
  }, [activeEdition]);

  const stats = useMemo(() => {
    const total = registrations.length;
    const men = registrations.filter((r) => r.sex === "male").length;
    const women = registrations.filter((r) => r.sex === "female").length;

    const run = registrations.filter((r) => r.participationType === "run").length;
    const walk = registrations.filter((r) => r.participationType === "nordic_walk").length;
    const kids = registrations.filter((r) => r.participationType === "kids_jogging").length;

    const bibAssigned = registrations.filter((r) => r.bibAssigned).length;
    const bibPending = registrations.filter((r) => !r.bibAssigned).length;

    const byDistanceMap = {};
    registrations.forEach((r) => {
      const key = r.distance || "Autre";
      byDistanceMap[key] = (byDistanceMap[key] || 0) + 1;
    });

    const distanceData = Object.entries(byDistanceMap).map(([name, value]) => ({
      name,
      value
    }));

    return {
      total,
      men,
      women,
      run,
      walk,
      kids,
      bibAssigned,
      bibPending,
      distanceData
    };
  }, [registrations]);

  const sexData = [
    { name: "Hommes", value: stats.men },
    { name: "Femmes", value: stats.women }
  ];

  const typeData = [
    { name: "Course", value: stats.run },
    { name: "Marche", value: stats.walk },
    { name: "Kids", value: stats.kids }
  ];

  const COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Statistiques</h1>
          <p style={styles.subtitle}>
            Vue en direct des inscriptions City Jogging {editionYear}
          </p>
        </div>

        <Link to="/guichet" style={styles.backLink}>
          Retour espace organisateur
        </Link>
      </div>

      <div style={styles.kpiGrid}>
        <StatCard title="Total inscrits" value={stats.total} />
        <StatCard title="Hommes" value={stats.men} />
        <StatCard title="Femmes" value={stats.women} />
        <StatCard title="Course" value={stats.run} />
        <StatCard title="Marche" value={stats.walk} />
        <StatCard title="Kids" value={stats.kids} />
        <StatCard title="Dossards attribués" value={stats.bibAssigned} />
        <StatCard title="En attente" value={stats.bibPending} />
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Répartition H/F</h3>
          </div>
          <div style={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sexData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {sexData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={styles.chartCard}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Types de participation</h3>
          </div>
          <div style={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {typeData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={styles.fullWidthCard}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Répartition par distance</h3>
        </div>
        <div style={styles.chartBoxLarge}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.distanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "24px",
    maxWidth: "1400px",
    margin: "0 auto"
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap"
  },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: "1.1"
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: "#667085",
    fontSize: "15px"
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
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  },
  statCard: {
    background: "white",
    borderRadius: "16px",
    padding: "18px 20px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)"
  },
  statTitle: {
    fontSize: "14px",
    color: "#667085",
    marginBottom: "8px"
  },
  statValue: {
    fontSize: "32px",
    fontWeight: 700,
    lineHeight: 1
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "20px",
    marginBottom: "20px"
  },
  chartCard: {
    background: "white",
    borderRadius: "18px",
    padding: "18px 18px 10px 18px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)"
  },
  fullWidthCard: {
    background: "white",
    borderRadius: "18px",
    padding: "18px 18px 10px 18px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)"
  },
  cardHeader: {
    marginBottom: "10px"
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px"
  },
  chartBox: {
    width: "100%",
    height: "300px"
  },
  chartBoxLarge: {
    width: "100%",
    height: "320px"
  }
};

export default StatsPage;
