import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/Button";
import { SlackButton } from "./SlackButton";

export function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <a href="https://www.outboxlabs.ai/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
          <img src="/logo.jpg" alt="Outbox Labs" className="size-7 rounded-md object-contain" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-ink">Outbox</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Labs</span>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <SlackButton />
          <a href="/admin/queues" target="_blank" rel="noreferrer" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:block">Queue monitor</a>
          <div className="flex items-center gap-3 border-l border-line pl-3">
            {user.avatar
              ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full" />
              : <div className="flex size-9 items-center justify-center rounded-full bg-brand font-bold text-white">{user.name[0]}</div>}
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-ink-soft">{user.email}</p>
            </div>
            <Button variant="ghost" className="!px-3 !py-2" onClick={logout}>Log out</Button>
          </div>
        </div>
      </div>
    </header>
  );
}
