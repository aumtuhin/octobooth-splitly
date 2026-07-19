import { useState } from "react";
import { Dices, Check } from "lucide-react";
import { api } from "../lib/api";
import type { User } from "../types";
import { AVATAR_STYLES, avatarStyleLabel, randomAvatar, type AvatarStyle } from "../lib/avatar";
import type { Theme } from "../lib/theme";
import { Avatar } from "./Avatar";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CHF", "CNY", "BRL", "SGD", "AED", "SEK", "NOK", "DKK", "NZD", "ZAR", "MXN"];
const THEMES: Theme[] = ["light", "dark", "system"];

const selectClass = "h-10 w-full rounded-xl border border-ink/20 bg-surf px-3 text-sm text-ink";

type Props = {
  token: string;
  user: User;
  onUserUpdated: (user: User) => void;
  onLoggedOut: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export function ProfileView({ token, user, onUserUpdated, onLoggedOut, theme, setTheme }: Props) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [currency, setCurrency] = useState(user.defaultCurrency);
  const [avatar, setAvatar] = useState<{ style: AvatarStyle; seed: string }>(() => ({
    style: (user.avatarStyle as AvatarStyle) || "funEmoji",
    seed: user.avatarSeed || user.username
  }));

  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  async function saveProfile() {
    if (!name.trim() || !username.trim()) return;
    setBusy(true);
    setError("");
    setSavedFlash(false);
    try {
      const updated = await api.updateProfile(token, {
        name: name.trim(),
        username: username.trim(),
        defaultCurrency: currency,
        avatarStyle: avatar.style,
        avatarSeed: avatar.seed
      });
      onUserUpdated(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setPwMsg("");
    if (pw.next.length < 8) {
      setPwMsg("New password must be at least 8 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg("New passwords do not match.");
      return;
    }
    try {
      await api.changePassword(token, pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("Password updated.");
    } catch (err) {
      setPwMsg((err as Error).message);
    }
  }

  async function deleteAccount() {
    const confirmed = window.prompt(
      "This permanently deletes your account and expenses you created. Type your username to confirm:"
    );
    if (confirmed !== user.username) {
      if (confirmed !== null) window.alert("Username did not match — account not deleted.");
      return;
    }
    try {
      await api.deleteAccount(token);
      onLoggedOut();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {/* Avatar */}
      <Card className="lg:col-span-1">
        <p className="mb-3 text-xs uppercase tracking-[0.2em]">Avatar</p>
        <div className="flex flex-col items-center gap-4">
          <Avatar style={avatar.style} seed={avatar.seed} name={name} size={112} />
          <Button variant="secondary" className="w-full" onClick={() => setAvatar(randomAvatar())}>
            <Dices size={16} className="mr-2" /> Randomize
          </Button>
          <select
            className={selectClass}
            value={avatar.style}
            onChange={(e) => setAvatar((a) => ({ ...a, style: e.target.value as AvatarStyle }))}
          >
            {AVATAR_STYLES.map((s) => (
              <option key={s} value={s}>
                {avatarStyleLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Details + preferences */}
      <Card className="lg:col-span-2">
        <p className="mb-3 text-xs uppercase tracking-[0.2em]">Profile & Preferences</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Username</span>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Default currency</span>
            <select className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Theme</span>
            <select className={selectClass} value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button className="mt-4" onClick={saveProfile} disabled={busy}>
          {savedFlash ? (
            <>
              <Check size={16} className="mr-2" /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </Card>

      {/* Account info */}
      <Card>
        <p className="mb-3 text-xs uppercase tracking-[0.2em]">Account</p>
        <div className="space-y-2 text-sm">
          <p className="flex justify-between gap-2">
            <span className="text-ink/60">Email</span>
            <span className="truncate">{user.email}</span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-ink/60">Member since</span>
            <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
          </p>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <p className="mb-3 text-xs uppercase tracking-[0.2em]">Change password</p>
        <Input type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} />
        <Input className="mt-2" type="password" placeholder="New password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} />
        <Input className="mt-2" type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} />
        {pwMsg && <p className="mt-2 text-sm text-ink/70">{pwMsg}</p>}
        <Button className="mt-3 w-full" variant="outline" onClick={changePassword}>
          Update password
        </Button>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/30">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-red-600">Danger zone</p>
        <p className="mb-3 text-sm text-ink/70">
          Deleting your account is permanent and removes expenses you created.
        </p>
        <Button className="w-full" variant="danger" onClick={deleteAccount}>
          Delete account
        </Button>
      </Card>
    </section>
  );
}
