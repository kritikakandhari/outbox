import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { EmailRow } from "../types";

/** Loads one list (scheduled or sent), refreshes every 10s so status changes show without a reload. */
export function useEmails(view: "scheduled" | "sent", query: string, refreshKey: number) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { setRows(await api.emails(view, query)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [view, query]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 10_000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  return { rows, loading, error };
}
