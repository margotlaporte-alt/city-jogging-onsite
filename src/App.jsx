import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./pages/ProtectedRoute";
import GuichetPage from "./pages/GuichetPage";
import ImportPreRegistrationsPage from "./pages/ImportPreRegistrationsPage";
import StatsPage from "./pages/StatsPage";
import PublicPage from "./pages/PublicPage";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<PublicPage />} />

          <Route
            path="/guichet"
            element={
              <ProtectedRoute>
                <GuichetPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/configuration"
            element={
              <ProtectedRoute requireAdmin>
                <ImportPreRegistrationsPage />
              </ProtectedRoute>
            }
          />

          <Route path="/import-preinscrits" element={<Navigate to="/configuration" replace />} />

          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
