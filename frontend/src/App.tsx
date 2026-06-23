import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Insights from "@/pages/Insights";
import Watchdog from "@/pages/Watchdog";
import Chatbot from "@/pages/Chatbot";
import LoginPage from "@/pages/LoginPage";
import SignUpPage from "@/pages/SignUpPage";
import OTPVerificationPage from "@/pages/OTPVerificationPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
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
