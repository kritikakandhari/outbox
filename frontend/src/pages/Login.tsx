import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";

export default function Login() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  const failed = new URLSearchParams(window.location.search).get("error");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo.jpg" alt="Outbox" className="size-10 rounded-lg object-contain shadow-xs" />
          <span className="text-sm font-bold uppercase tracking-wider text-ink-soft">Outbox Labs</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Outbox Scheduler</h1>
        <p className="mt-2 text-ink-soft">Schedule cold emails once. They go out on time, even if the server restarts.</p>
        {failed === "google_credentials_missing" ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            Google Client ID & Secret are not added yet. Please add them in Render settings, or use One-Click Demo Login below!
          </p>
        ) : failed ? (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-bad">
            Google sign-in failed. Please try again or use One-Click Demo Login.
          </p>
        ) : null}
        <Button className="mt-8 w-full" onClick={() => (window.location.href = "/auth/google")}>
          Continue with Google
        </Button>
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-line" />
          <span className="absolute bg-white px-3 text-xs uppercase tracking-wider text-ink-soft">or test instantly</span>
        </div>
        <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/auth/dev-login")}>
          One-Click Demo Login
        </Button>
      </div>
    </main>
  );
}
