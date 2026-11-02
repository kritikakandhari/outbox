import { useEffect, useState } from "react";
import { api } from "../api";
import type { SlackStatus } from "../types";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

export function SlackButton() {
  const toast = useToast();
  const [status, setStatus] = useState<SlackStatus | null>(null);

  useEffect(() => { api.slackStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("slack");
    if (p === "connected") toast("Slack connected. You will be alerted when a limit is hit.");
    if (p === "error") toast("Slack connection failed. Try again.", "error");
  }, [toast]);

  if (!status) return null;
  if (status.connected) {
    return (
      <Button variant="outline" className="!py-2" onClick={async () => { await api.slackDisconnect(); setStatus({ ...status, connected: false }); toast("Slack disconnected"); }}>
        Slack: {status.channel ?? "connected"} · Disconnect
      </Button>
    );
  }
  // Full-page navigation: this starts the real Slack OAuth flow on the backend.
  return <Button variant="outline" className="!py-2" onClick={() => (window.location.href = "/api/slack/connect")}>Connect Slack</Button>;
}
