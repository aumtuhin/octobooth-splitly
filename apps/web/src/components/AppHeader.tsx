import { formatMoney } from "../lib/api";
import { Avatar } from "./Avatar";
import { Button } from "./ui/button";

type Props = {
  userName?: string;
  avatarStyle?: string | null;
  avatarSeed?: string | null;
  netBalanceCents: number;
  currency?: string;
  onLogout: () => void;
  onOpenProfile: () => void;
};

export function AppHeader({ userName, avatarStyle, avatarSeed, netBalanceCents, currency, onLogout, onOpenProfile }: Props) {
  return (
    <header className="mb-6 rounded-3xl border border-ink/10 bg-gradient-to-r from-sage/30 via-shell to-aqua/40 p-4 shadow-panel md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onOpenProfile} className="flex items-center gap-3 text-left" aria-label="Open profile">
          <Avatar style={avatarStyle} seed={avatarSeed} name={userName} size={48} />
          <div>
            <p className="text-xs uppercase tracking-[0.2em]">Dashboard</p>
            <h1 className="font-display text-3xl">Welcome back, {userName}</h1>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <p className="rounded-xl bg-surf/80 px-3 py-2 text-sm">Net: {formatMoney(netBalanceCents, currency)}</p>
          <Button variant="outline" onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </header>
  );
}
