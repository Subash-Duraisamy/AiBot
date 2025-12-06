import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import EventDashboardPage from "./pages/EventDashboardPage"; // ✅ NEW

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/chat" element={<Chat />} />

      {/* ✅ NEW FULL SCREEN DASHBOARD PAGE */}
      <Route path="/dashboard" element={<EventDashboardPage />} />
    </Routes>
  );
}
