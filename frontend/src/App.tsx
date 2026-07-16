import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Insights = lazy(() => import("@/pages/Insights"));
const Watchdog = lazy(() => import("@/pages/Watchdog"));
const Chatbot = lazy(() => import("@/pages/Chatbot"));
const Federal = lazy(() => import("@/pages/Federal"));
const Provincial = lazy(() => import("@/pages/Provincial"));
const Local = lazy(() => import("@/pages/Local"));
const EconomicIndicators = lazy(() => import("@/pages/EconomicIndicators"));
const Budget = lazy(() => import("@/pages/Budget"));
const DirectoryPage = lazy(() => import("@/pages/DirectoryPage"));
const UtilityPage = lazy(() => import("@/pages/UtilityPage"));

function PageFallback() {
  return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="flex items-center gap-3 text-sm font-medium text-slate-600"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"/>Loading public records…</div></div>;
}

export default function App() {
  return <BrowserRouter><Suspense fallback={<PageFallback />}><Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/budget" element={<Budget />} />
    <Route path="/federal" element={<Federal />} />
    <Route path="/provincial" element={<Provincial />} />
    <Route path="/local" element={<Local />} />
    <Route path="/procurement" element={<DirectoryPage kind="procurement" />} />
    <Route path="/contractors" element={<DirectoryPage kind="contractors" />} />
    <Route path="/fiscal-transfers" element={<DirectoryPage kind="transfers" />} />
    <Route path="/economic-indicators" element={<EconomicIndicators />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/watchdog" element={<Watchdog />} />
    <Route path="/chatbot" element={<Chatbot />} />
    <Route path="/api" element={<UtilityPage type="api" />} />
    <Route path="/settings" element={<UtilityPage type="settings" />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></BrowserRouter>;
}
