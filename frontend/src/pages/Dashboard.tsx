import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useEmails } from "../hooks/useEmails";
import { Header } from "../components/Header";
import { EmailTable } from "../components/EmailTable";
import { ComposeModal } from "../components/ComposeModal";
import { Button } from "../components/ui/Button";

type Tab = "scheduled" | "sent";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("scheduled");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { rows, loading, error } = useEmails(tab, query, refreshKey);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
            {(["scheduled", "sent"] as Tab[]).map((t) => (
              <button
                key={t} onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {t} emails
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search emails"
              aria-label="Search emails"
              className="w-48 rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus:border-brand sm:w-64"
            />
            <Button onClick={() => setComposing(true)}>Compose new email</Button>
          </div>
        </div>

        <section className="rounded-2xl border border-line bg-white">
          {tab === "scheduled" ? (
            <EmailTable
              rows={rows} loading={loading} error={error}
              timeLabel="Scheduled time" timeOf={(r) => r.scheduledAt}
              emptyTitle={query ? "No matching emails" : "Nothing scheduled"}
              emptyText={query ? "Try a different search." : "Upload a list of leads and pick a start time to queue your first batch."}
              onEmptyAction={query ? undefined : () => setComposing(true)} emptyActionLabel="Compose new email"
            />
          ) : (
            <EmailTable
              rows={rows} loading={loading} error={error}
              timeLabel="Sent time" timeOf={(r) => r.sentAt}
              emptyTitle={query ? "No matching emails" : "No emails sent yet"}
              emptyText={query ? "Try a different search." : "Sent and failed emails appear here once the scheduler delivers them."}
            />
          )}
        </section>
      </main>
      {composing && <ComposeModal onClose={() => setComposing(false)} onScheduled={() => { setTab("scheduled"); setRefreshKey((k) => k + 1); }} />}
    </>
  );
}
