import { useEffect, useState } from "react";
import { api } from "../api";
import type { SlackStatus } from "../types";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

export function SlackButton() {
  const toast = useToast();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.slackStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("slack");
    if (p === "connected") toast("Slack connected. You will be alerted when a limit is hit.");
    if (p === "error") toast("Slack connection failed. Try again.", "error");
  }, [toast]);

  if (!status) return null;
  if (status.connected) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex size-2 rounded-full bg-ok" title="Slack connected" />
        <Button variant="outline" className="!py-1.5 !px-3 text-xs" onClick={async () => { await api.slackDisconnect(); setStatus({ ...status, connected: false }); toast("Slack disconnected"); }}>
          Slack: {status.channel ?? "Active"} · Disconnect
        </Button>
      </div>
    );
  }

  const connectWebhook = async () => {
    if (!webhookInput.trim().startsWith("http")) {
      return toast("Please enter a valid webhook URL (https://hooks.slack.com/...)", "error");
    }
    setLoading(true);
    try {
      await api.slackConnectWebhook(webhookInput.trim());
      setStatus({ connected: true, team: "Slack Team", channel: "#alerts" });
      setShowPrompt(false);
      toast("Slack webhook connected successfully!");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Button variant="outline" className="!py-1.5 !px-3 text-xs font-semibold" onClick={() => (window.location.href = "/api/slack/connect")}>
          Connect Slack (OAuth)
        </Button>
        <button
          type="button"
          onClick={() => setShowPrompt((p) => !p)}
          className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft hover:bg-surface"
          title="Connect via Webhook URL"
        >
          Webhook
        </button>
      </div>

      {showPrompt && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-line bg-white p-3 shadow-lg z-50">
          <p className="text-xs font-bold text-ink">Connect Slack Incoming Webhook</p>
          <p className="mt-1 text-[11px] text-ink-soft">
            Paste your Slack Incoming Webhook URL to receive live rate-limit alerts.
          </p>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            className="mt-2 w-full rounded-md border border-line px-2.5 py-1.5 text-xs focus:border-brand"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="px-2 py-1 text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <Button className="!py-1 !px-2.5 text-xs" loading={loading} onClick={connectWebhook}>
              Save Webhook
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
