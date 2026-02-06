import { useState } from "react";

import StatusBanner from "../components/StatusBanner";
import DashboardPage from "./DashboardPage";
import RequestStatusPage from "./RequestStatusPage";
import { useDashboard } from "../state/useDashboard";

const TABS = ["Dashboard", "Request Status"] as const;

export default function AppShell() {
  const { state, actions, answerMap } = useDashboard();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Dashboard");
  const pendingRequests = state.requestIds.filter((requestId) => {
    const status = state.requestStatuses[requestId]?.status;
    return status !== "SUCCESS" && status !== "FAILED";
  }).length;
  const tabBase =
    "rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-20 pt-8 md:px-6">
      <section className="mb-7 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#9a6a3a]">Due Diligence Intelligence</p>
          <h1 className="font-serif text-[clamp(2.4rem,4vw,3.4rem)] font-semibold tracking-tight text-[#101419]">
            Questionnaire Agent
          </h1>
          <p className="mt-2 text-base text-[#3b4045]">
            Index documents, parse questionnaires, generate answers with citations, and drive confident human review.
          </p>
        </div>
        <div className="rounded-[20px] border border-[#eadfce] bg-[linear-gradient(150deg,#ffffff,#f7efe3)] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-[#5a5f65]">Active Projects</span>
            <strong className="text-lg font-semibold text-[#101419]">{state.projects.length}</strong>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-[#5a5f65]">Indexed Docs</span>
            <strong className="text-lg font-semibold text-[#101419]">{state.documents.length}</strong>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-[#5a5f65]">Pending Requests</span>
            <strong className="text-lg font-semibold text-[#101419]">{pendingRequests}</strong>
          </div>
        </div>
      </section>
      <StatusBanner message={state.statusMessage} />
      <nav className="mb-7 mt-5 flex flex-wrap gap-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={
              tab === activeTab
                ? `${tabBase} border-[#101419] bg-[#101419] text-white`
                : `${tabBase} border-[#e0d6c8] bg-transparent text-[#101419]`
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Dashboard" ? (
        <DashboardPage state={state} actions={actions} answerMap={answerMap} />
      ) : (
        <RequestStatusPage state={state} actions={actions} />
      )}
    </main>
  );
}
