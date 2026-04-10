import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./pages/ProtectedRoute";
import GuichetPage from "./pages/GuichetPage";
import ImportPreRegistrationsPage from "./pages/ImportPreRegistrationsPage";
import StatsPage from "./pages/StatsPage";
import PublicPage from "./pages/PublicPage";

function App() {
  return (
    <BrowserRouter>
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
          path="/import-preinscrits"
          element={
            <ProtectedRoute>
              <ImportPreRegistrationsPage />
            </ProtectedRoute>
          }
        />

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
    </BrowserRouter>
  );
}

export default App;