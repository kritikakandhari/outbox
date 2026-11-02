import type { EmailStatus } from "../../types";

const styles: Record<EmailStatus, string> = {
  scheduled: "bg-amber-50 text-warn",
  processing: "bg-blue-50 text-brand",
  sent: "bg-emerald-50 text-ok",
  failed: "bg-red-50 text-bad",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status]}`}>{status}</span>;
}
