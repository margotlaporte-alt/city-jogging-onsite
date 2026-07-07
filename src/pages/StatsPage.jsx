import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../services/firebase";
import {
  DEFAULT_APP_CONFIG,
  getEditionYear,
  subscribeToAppConfig
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
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [config, setConfig] = useState(DEFAULT_APP_CONFIG);
  const [selectedEdition, setSelectedEdition] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToAppConfig(
      (nextConfig) => {
        setConfig(nextConfig);
      },
      (error) => {
        console.error("Erreur chargement edition stats :", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "onsite_registrations"),
      (snapshot) => {
        setAllRegistrations(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const availableEditions = useMemo(() => {
    const uniqueEditions = new Set(
      allRegistrations
        .map((registration) => String(registration.eventEdition || "").trim())
        .filter(Boolean)
    );

    uniqueEditions.add(config.onsiteActiveEdition);
    uniqueEditions.add(config.importTargetEdition);

    return Array.from(uniqueEditions).sort((leftEdition, rightEdition) => {
      const leftYear = Number(getEditionYear(leftEdition)) || 0;
      const rightYear = Number(getEditionYear(rightEdition)) || 0;

      if (leftYear !== rightYear) {
        return rightYear - leftYear;
      }

      return rightEdition.localeCompare(leftEdition, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    });
  }, [allRegistrations, config.importTargetEdition, config.onsiteActiveEdition]);

  const editionCounts = useMemo(() => {
    const counts = new Map();

    allRegistrations.forEach((registration) => {
      const edition = String(registration.eventEdition || "").trim();

      if (!edition) {
        return;
      }

      counts.set(edition, (counts.get(edition) || 0) + 1);
    });

    return counts;
  }, [allRegistrations]);

  const duplicateYears = useMemo(() => {
    const counts = new Map();

    availableEditions.forEach((edition) => {
      const year = getEditionYear(edition);
      counts.set(year, (counts.get(year) || 0) + 1);
    });

    return counts;
  }, [availableEditions]);

  useEffect(() => {
    if (availableEditions.length === 0) {
      return;
    }

    const preferredEdition = availableEditions.includes(config.onsiteActiveEdition)
      ? config.onsiteActiveEdition
      : availableEditions[0];

    if (!selectedEdition || !availableEditions.includes(selectedEdition)) {
      setSelectedEdition(preferredEdition);
    }
  }, [availableEditions, config.onsiteActiveEdition, selectedEdition]);

  const registrations = useMemo(() => {
    return allRegistrations.filter(
      (registration) => registration.eventEdition === selectedEdition
    );
  }, [allRegistrations, selectedEdition]);

  const editionYear = getEditionYear(
    selectedEdition || availableEditions[0] || config.onsiteActiveEdition
  );

  const stats = useMemo(() => {
    const total = registrations.length;
    const men = registrations.filter((r) => r.sex === "male").length;
    const women = registrations.filter((r) => r.sex === "female").length;
    const onsiteDayRegistrations = registrations.filter(
      (r) => r.source === "public-form" || r.source === "onsite-organizer"
    );
    const onsiteDayTotal = onsiteDayRegistrations.length;
    const publicOnsiteTotal = onsiteDayRegistrations.filter(
      (r) => r.source === "public-form"
    ).length;
    const organizerOnsiteTotal = onsiteDayRegistrations.filter(
      (r) => r.source === "onsite-organizer"
    ).length;

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
      onsiteDayTotal,
      publicOnsiteTotal,
      organizerOnsiteTotal,
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

  const formatEditionOptionLabel = (edition) => {
    const year = getEditionYear(edition);
    const count = editionCounts.get(edition) || 0;
    const hasDuplicateYear = (duplicateYears.get(year) || 0) > 1;

    if (hasDuplicateYear) {
      return `City Jogging ${year} - ${edition} (${count} inscrits)`;
    }

    return `City Jogging ${year} (${count} inscrits)`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Statistiques</h1>
          <p style={styles.subtitle}>
            Vue en direct des inscriptions City Jogging {editionYear}
          </p>
        </div>

        <div style={styles.topBarActions}>
          <label style={styles.selectGroup}>
            <span style={styles.selectLabel}>Edition affichee</span>
            <select
              value={selectedEdition}
              onChange={(event) => setSelectedEdition(event.target.value)}
              style={styles.select}
            >
              {availableEditions.map((edition) => (
                <option key={edition} value={edition}>
                  {formatEditionOptionLabel(edition)}
                </option>
              ))}
            </select>
          </label>

          <Link to="/guichet" style={styles.backLink}>
            Retour espace organisateur
          </Link>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <StatCard title="Total inscrits" value={stats.total} />
        <StatCard
          title="Inscrits sur place"
          value={stats.onsiteDayTotal}
        />
        <StatCard
          title="Via LeGuichet public"
          value={stats.publicOnsiteTotal}
        />
        <StatCard
          title="Saisie manuelle organisateur"
          value={stats.organizerOnsiteTotal}
        />
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
    padding: "24px clamp(12px, 2vw, 28px)",
    width: "100%",
    maxWidth: "1800px",
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
  topBarActions: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end"
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
  selectGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  selectLabel: {
    fontSize: "12px",
    color: "#667085",
    fontWeight: 600
  },
  select: {
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    background: "white",
    color: "#101828",
    padding: "10px 12px",
    minWidth: "190px"
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
