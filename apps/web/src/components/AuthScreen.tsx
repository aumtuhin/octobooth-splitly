import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export type AuthMode = "login" | "signup";

export type AuthFormState = {
  name: string;
  username: string;
  email: string;
  password: string;
};

type FieldErrors = Partial<Record<keyof AuthFormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

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
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(authForm.email.trim())) next.email = "Enter a valid email address.";
    if (mode === "signup") {
      if (authForm.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
      if (authForm.username.trim().length < 3 || authForm.username.trim().length > 30) {
        next.username = "Username must be 3–30 characters.";
      } else if (!USERNAME_RE.test(authForm.username.trim())) {
        next.username = "Use only letters, numbers, and . _ -";
      }
      if (authForm.password.length < 8) next.password = "Password must be at least 8 characters.";
    } else if (!authForm.password) {
      next.password = "Password is required.";
    }
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(e);
  }

  const update = (field: keyof AuthFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAuthForm((s) => ({ ...s, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const fieldError = (field: keyof AuthFormState) =>
    errors[field] ? <p className="mt-1 text-xs text-red-600">{errors[field]}</p> : null;

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
            <Button variant={mode === "login" ? "default" : "outline"} onClick={() => { onModeChange("login"); setErrors({}); }}>Log In</Button>
            <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => { onModeChange("signup"); setErrors({}); }}>Sign Up</Button>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <>
                <div>
                  <Input placeholder="Full name" value={authForm.name} onChange={update("name")} aria-invalid={!!errors.name} />
                  {fieldError("name")}
                </div>
                <div>
                  <Input placeholder="Username" value={authForm.username} onChange={update("username")} aria-invalid={!!errors.username} />
                  {fieldError("username")}
                </div>
              </>
            )}
            <div>
              <Input type="email" placeholder="Email" value={authForm.email} onChange={update("email")} aria-invalid={!!errors.email} />
              {fieldError("email")}
            </div>
            <div>
              <Input type="password" placeholder="Password" value={authForm.password} onChange={update("password")} aria-invalid={!!errors.password} />
              {fieldError("password")}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Log In" : "Create account"}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
