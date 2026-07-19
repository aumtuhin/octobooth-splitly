import type { FormEvent } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export type AuthMode = "login" | "signup";

export type AuthFormState = {
  name: string;
  username: string;
  email: string;
  password: string;
  defaultCurrency: string;
};

type Props = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  authForm: AuthFormState;
  setAuthForm: React.Dispatch<React.SetStateAction<AuthFormState>>;
  error: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function AuthScreen({ mode, onModeChange, authForm, setAuthForm, error, loading, onSubmit }: Props) {
  return (
    <main className="min-h-screen bg-shell px-4 py-10 text-ink md:px-10">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <Card className="flex flex-col justify-between bg-gradient-to-br from-peach/70 via-shell to-aqua/60">
          <div>
            <p className="text-xs uppercase tracking-[0.2em]">Splitly</p>
            <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Shared expenses without friendship debt</h1>
          </div>
          <div className="mt-10 grid gap-3 text-sm">
            <p className="rounded-xl bg-surf/70 p-3">Track every bill by group, trip, or household.</p>
            <p className="rounded-xl bg-surf/70 p-3">Split by equal, exact, percentage, or shares.</p>
            <p className="rounded-xl bg-surf/70 p-3">Simplify who pays whom with one tap.</p>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex gap-2">
            <Button variant={mode === "login" ? "default" : "outline"} onClick={() => onModeChange("login")}>Log In</Button>
            <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => onModeChange("signup")}>Sign Up</Button>
          </div>
          <form className="space-y-3" onSubmit={onSubmit}>
            {mode === "signup" && (
              <>
                <Input placeholder="Full name" value={authForm.name} onChange={(e) => setAuthForm((s) => ({ ...s, name: e.target.value }))} />
                <Input placeholder="Username" value={authForm.username} onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))} />
              </>
            )}
            <Input type="email" placeholder="Email" value={authForm.email} onChange={(e) => setAuthForm((s) => ({ ...s, email: e.target.value }))} />
            <Input type="password" placeholder="Password" value={authForm.password} onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))} />
            {mode === "signup" && (
              <Input placeholder="Default currency (USD)" value={authForm.defaultCurrency} onChange={(e) => setAuthForm((s) => ({ ...s, defaultCurrency: e.target.value.toUpperCase() }))} />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Log In" : "Create account"}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
