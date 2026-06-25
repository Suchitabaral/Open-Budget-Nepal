import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Insights from "@/pages/Insights";
import Watchdog from "@/pages/Watchdog";
import Chatbot from "@/pages/Chatbot";
import LoginPage from "@/pages/LoginPage";
import SignUpPage from "@/pages/SignUpPage";
import OTPVerificationPage from "@/pages/OTPVerificationPage";
import Federal from "@/pages/Federal";
import Provincial from "@/pages/Provincial";
import Local from "@/pages/Local";
import EconomicIndicators from "@/pages/EconomicIndicators";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/federal" element={<Federal />} />
        <Route path="/provincial" element={<Provincial />} />
        <Route path="/local" element={<Local />} />
        <Route path="/economic-indicators" element={<EconomicIndicators />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/watchdog" element={<Watchdog />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/otp-verification" element={<OTPVerificationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
