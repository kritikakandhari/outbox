import type { EmailRow } from "../types";
import { StatusBadge } from "./ui/StatusBadge";
import { Button } from "./ui/Button";

interface Props {
  rows: EmailRow[];
  loading: boolean;
  error: string | null;
  timeLabel: string;
  timeOf: (r: EmailRow) => string | null;
  emptyTitle: string;
  emptyText: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

/** One table for both tabs - only the time column and the empty state differ. */
export function EmailTable({ rows, loading, error, timeLabel, timeOf, emptyTitle, emptyText, onEmptyAction, emptyActionLabel }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-surface" />)}
      </div>
    );
  }
  if (error) return <p className="p-8 text-center text-sm text-bad">Could not load emails: {error}</p>;
  if (!rows.length) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-bold">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{emptyText}</p>
        {onEmptyAction && <Button className="mt-5" onClick={onEmptyAction}>{emptyActionLabel}</Button>}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-ink-soft">
          <tr>
            <th className="px-6 py-3 font-semibold">Email</th>
            <th className="px-6 py-3 font-semibold">Subject</th>
            <th className="px-6 py-3 font-semibold">{timeLabel}</th>
            <th className="px-6 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
              <td className="px-6 py-3.5 font-medium">{r.to}</td>
              <td className="max-w-xs truncate px-6 py-3.5 text-ink-soft">{r.subject}</td>
              <td className="whitespace-nowrap px-6 py-3.5 text-ink-soft">{fmt(timeOf(r))}</td>
              <td className="px-6 py-3.5">
                <StatusBadge status={r.status} />
                {r.previewUrl && (
                  <a href={r.previewUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs font-semibold text-brand hover:underline">preview</a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
