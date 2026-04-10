import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedGuichetPage from "./pages/ProtectedGuichetPage";
import GuichetPage from "./pages/GuichetPage";
import ImportPreRegistrationsPage from "./pages/ImportPreRegistrationsPage";
import StatsPage from "./pages/StatsPage";
import PublicPage from "./pages/PublicPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicPage />} />

        <Route element={<ProtectedGuichetPage />}>
          <Route path="/guichet" element={<GuichetPage />} />
          <Route path="/import-preinscrits" element={<ImportPreRegistrationsPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;