import Section from "../components/Section";
import type { DashboardActions, DashboardState } from "../state/useDashboard";

interface RequestStatusPageProps {
  state: DashboardState;
  actions: DashboardActions;
}

export default function RequestStatusPage({ state, actions }: RequestStatusPageProps) {
  const cardBase = "rounded-2xl border border-[#efe7dd] bg-[#fcfbfa] p-4 md:p-5";
  const smallText = "text-sm text-[#4b4f53]";
  const secondaryButton =
    "mt-3 inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#f1e9de] px-4 py-2 text-sm font-semibold text-[#101419] transition disabled:cursor-not-allowed disabled:opacity-70";
  const errorText = "mt-3 rounded-xl border border-[#f3c9c2] bg-[#fbeeed] px-3 py-2 text-sm text-[#a23b2a]";

  return (
    <Section
      title="Request Status"
      description="Track async operations for indexing and project updates."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.requestIds.length === 0 && (
          <p className={smallText}>No async requests yet. Index a document or create a project.</p>
        )}
        {state.requestIds.map((requestId) => {
          const request = state.requestStatuses[requestId];
          return (
            <div key={requestId} className={cardBase}>
              <p className={smallText}>Request ID: {requestId}</p>
              <p className={smallText}>Status: {request?.status ?? "UNKNOWN"}</p>
              {request?.message && <p className={errorText}>{request.message}</p>}
              <button className={secondaryButton} onClick={() => void actions.refreshRequestStatus(requestId)}>
                Refresh
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
