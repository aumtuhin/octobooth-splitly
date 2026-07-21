import type { Activity, Expense, Friend, Group, GroupDetail, User } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
let resolvedApiBase: string | null = null;

function buildApiCandidates(): string[] {
  const candidates = new Set<string>();
  candidates.add(API_BASE);

  try {
    const url = new URL(API_BASE);
    if (url.hostname === "localhost" && /^40\d\d$/.test(url.port || "")) {
      const current = Number(url.port);
      for (let port = current; port <= current + 5; port += 1) {
        const candidate = new URL(API_BASE);
        candidate.port = String(port);
        candidates.add(candidate.toString().replace(/\/$/, ""));
      }
    }
  } catch {
    // Ignore malformed API base and use the original configured value.
  }

  return Array.from(candidates);
}

export type AuthResponse = {
  token: string;
  user: User;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const candidates = resolvedApiBase ? [resolvedApiBase] : buildApiCandidates();
  let lastError: Error | null = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers ?? {})
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Request failed" }));
        const error = new Error(data.message ?? "Request failed") as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      resolvedApiBase = base;

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("Request failed");
}

export const api = {
  signup(payload: { name: string; username: string; email: string; password: string }) {
    return request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(payload) });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },
  me(token: string) {
    return request<User>("/me", {}, token);
  },
  updateProfile(
    token: string,
    payload: Partial<{ name: string; username: string; defaultCurrency: string; avatarStyle: string; avatarSeed: string }>
  ) {
    return request<User>("/me", { method: "PATCH", body: JSON.stringify(payload) }, token);
  },
  changePassword(token: string, currentPassword: string, newPassword: string) {
    return request<void>("/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }, token);
  },
  deleteAccount(token: string) {
    return request<void>("/me", { method: "DELETE" }, token);
  },
  dashboard(token: string) {
    return request<{ totalBalanceCents: number; recentActivity: Activity[]; recentExpenses: Expense[] }>("/dashboard", {}, token);
  },
  friends(token: string) {
    return request<Friend[]>("/friends", {}, token);
  },
  friendRequests(token: string) {
    return request<{ incoming: Array<Record<string, unknown>>; outgoing: Array<Record<string, unknown>> }>("/friends/requests", {}, token);
  },
  sendFriendRequest(token: string, recipient: string) {
    return request("/friends/requests", { method: "POST", body: JSON.stringify({ recipient }) }, token);
  },
  respondFriendRequest(token: string, id: string, action: "accept" | "decline") {
    return request(`/friends/requests/${id}`, { method: "POST", body: JSON.stringify({ action }) }, token);
  },
  groups(token: string) {
    return request<Group[]>("/groups", {}, token);
  },
  getGroup(token: string, id: string) {
    return request<GroupDetail>(`/groups/${id}`, {}, token);
  },
  createGroup(token: string, payload: { name: string; description?: string; memberIds?: string[] }) {
    return request("/groups", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  expenses(token: string) {
    return request<Expense[]>("/expenses", {}, token);
  },
  createExpense(token: string, payload: Record<string, unknown>) {
    return request("/expenses", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  updateExpense(token: string, id: string, payload: Record<string, unknown>) {
    return request<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
  },
  deleteExpense(token: string, id: string) {
    return request<void>(`/expenses/${id}`, { method: "DELETE" }, token);
  },
  balances(token: string, groupId?: string) {
    const qs = groupId ? `?groupId=${groupId}` : "";
    return request<{ simplified: Array<{ fromUserId: string; toUserId: string; amountCents: number }> }>(`/balances${qs}`, {}, token);
  },
  activity(token: string) {
    return request<Activity[]>("/activity", {}, token);
  },
  settle(token: string, payload: { payerId: string; receiverId: string; amountCents: number; currency: string; date: string; groupId?: string; note?: string }) {
    return request("/settlements", { method: "POST", body: JSON.stringify(payload) }, token);
  }
};

// Re-exported so existing imports (`import { formatMoney } from "../lib/api"`)
// keep working; the implementation lives in lib/money.ts.
export { formatMoney } from "./money";
