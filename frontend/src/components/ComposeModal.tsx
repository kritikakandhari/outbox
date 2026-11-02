import { useRef, useState } from "react";
import { api } from "../api";
import { extractEmails, toLocalInput } from "../lib";
import { Modal } from "./ui/Modal";
import { Input, Textarea } from "./ui/Field";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

export function ComposeModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [start, setStart] = useState(toLocalInput(new Date(Date.now() + 5 * 60_000)));
  const [delay, setDelay] = useState(2);
  const [hourly, setHourly] = useState(200);
  const [saving, setSaving] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    const found = extractEmails(await file.text());
    setRecipients(found);
    setFileName(file.name);
    if (!found.length) toast("No email addresses found in that file", "error");
  };

  const submit = async () => {
    if (!subject.trim() || !body.trim()) return toast("Add a subject and a body", "error");
    if (!recipients.length) return toast("Upload a file with at least one email address", "error");
    setSaving(true);
    try {
      const r = await api.schedule({
        subject, body, recipients,
        startTime: new Date(start).toISOString(),
        delaySeconds: delay, hourlyLimit: hourly,
      });
      toast(`Scheduled ${r.count} emails`);
      onScheduled();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Compose new email" onClose={onClose}>
      <div className="space-y-4">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your onboarding" />
        <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi there, ..." />

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Leads</span>
          <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button
            type="button" onClick={() => fileRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-brand/50 bg-brand/5 px-4 py-4 text-sm text-ink-soft hover:bg-brand/10"
          >
            {recipients.length
              ? <><b className="text-ink">{recipients.length}</b> email addresses found in {fileName}</>
              : "Upload a CSV or text file of email addresses"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Start time" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Delay (seconds)" type="number" min={0} value={delay} onChange={(e) => setDelay(Number(e.target.value))} hint="Gap between emails" />
          <Input label="Hourly limit" type="number" min={1} value={hourly} onChange={(e) => setHourly(Number(e.target.value))} hint="Per sender" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit}>Schedule {recipients.length ? `${recipients.length} emails` : ""}</Button>
        </div>
      </div>
    </Modal>
  );
}
