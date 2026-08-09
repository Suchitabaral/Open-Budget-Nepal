import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const Insights = lazy(() => import("@/features/budget-insights/pages/BudgetInsightsPage"));
const OpenBudgetMap = lazy(() => import("@/features/open-budget-map/pages/OpenBudgetMapPage"));
const Watchdog = lazy(() => import("@/features/watchdog/pages/WatchdogPage"));
const Chatbot = lazy(() => import("@/features/assistant/pages/AssistantPage"));
const Federal = lazy(() => import("@/features/legacy-budget/pages/FederalPage"));
const Provincial = lazy(() => import("@/features/legacy-budget/pages/ProvincialPage"));
const Local = lazy(() => import("@/features/legacy-budget/pages/LocalPage"));
const EconomicIndicators = lazy(() => import("@/features/economic-indicators/pages/EconomicIndicatorsPage"));
const Budget = lazy(() => import("@/features/legacy-budget/pages/BudgetPage"));
const DirectoryPage = lazy(() => import("@/features/public-records/pages/DirectoryPage"));
const UtilityPage = lazy(() => import("@/features/platform/pages/UtilityPage"));

function PageFallback() {
  return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="flex items-center gap-3 text-sm font-medium text-slate-600"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"/>Loading public records…</div></div>;
}

export default function App() {
  return <BrowserRouter><Suspense fallback={<PageFallback />}><Routes>
    <Route path="/" element={<OpenBudgetMap />} />
    <Route path="/budget" element={<Budget />} />
    <Route path="/federal" element={<Federal />} />
    <Route path="/provincial" element={<Provincial />} />
    <Route path="/local" element={<Local />} />
    <Route path="/procurement" element={<DirectoryPage kind="procurement" />} />
    <Route path="/contractors" element={<DirectoryPage kind="contractors" />} />
    <Route path="/fiscal-transfers" element={<DirectoryPage kind="transfers" />} />
    <Route path="/economic-indicators" element={<EconomicIndicators />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/insights/federal" element={<Insights />} />
    <Route path="/insights/provincial" element={<Insights />} />
    <Route path="/insights/local" element={<Insights />} />
    <Route path="/watchdog" element={<Watchdog />} />
    <Route path="/chatbot" element={<Chatbot />} />
    <Route path="/api" element={<UtilityPage type="api" />} />
    <Route path="/settings" element={<UtilityPage type="settings" />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></BrowserRouter>;
}
