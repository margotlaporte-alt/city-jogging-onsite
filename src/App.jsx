import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedGuichetPage from "./pages/ProtectedGuichetPage";
import ImportPreRegistrationsPage from "./pages/ImportPreRegistrationsPage";
import StatsPage from "./pages/StatsPage";
import PublicPage from "./pages/PublicPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/guichet" element={<ProtectedGuichetPage />} />
        <Route path="/import-preinscrits" element={<ProtectedGuichetPage><ImportPreRegistrationsPage /></ProtectedGuichetPage>} />
        <Route path="/stats" element={<ProtectedGuichetPage><StatsPage /></ProtectedGuichetPage>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;