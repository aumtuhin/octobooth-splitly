import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, HandCoins, Receipt, Users } from "lucide-react";
import { api, formatMoney } from "./lib/api";
import type { Activity, Expense, Friend, Group, User } from "./types";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { GroupDetail } from "./components/GroupDetail";

type AuthMode = "login" | "signup";
type View = "dashboard" | "friends" | "groups" | "expenses" | "activity";

type DashboardData = {
  totalBalanceCents: number;
  recentActivity: Activity[];
  recentExpenses: Expense[];
};

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("splitly_token") ?? "");
  const [mode, setMode] = useState<AuthMode>("login");
  const [view, setView] = useState<View>("dashboard");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [simplified, setSimplified] = useState<Array<{ fromUserId: string; toUserId: string; amountCents: number }>>([]);
  const [requests, setRequests] = useState<{ incoming: Array<Record<string, unknown>>; outgoing: Array<Record<string, unknown>> }>({ incoming: [], outgoing: [] });

  const [authForm, setAuthForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    defaultCurrency: "USD"
  });

  const [friendRecipient, setFriendRecipient] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [settleForm, setSettleForm] = useState({ receiverId: "", amountCents: 0, note: "" });
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amountCents: 0,
    currency: "USD",
    splitType: "EQUAL" as const,
    category: "food",
    note: "",
    groupId: ""
  });

  async function refreshData(authToken: string) {
    const [me, dash, fs, gs, ex, act, bal, req] = await Promise.all([
      api.me(authToken),
      api.dashboard(authToken),
      api.friends(authToken),
      api.groups(authToken),
      api.expenses(authToken),
      api.activity(authToken),
      api.balances(authToken),
      api.friendRequests(authToken)
    ]);

    setUser(me);
    setDashboard(dash);
    setFriends(fs);
    setGroups(gs);
    setExpenses(ex);
    setActivity(act);
    setSimplified(bal.simplified);
    setRequests(req);
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refreshData(token)
      .catch((err: Error) => {
        localStorage.removeItem("splitly_token");
        setToken("");
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (user) map.set(user.id, user.name);
    for (const f of friends) map.set(f.id, f.name);
    for (const g of groups) {
      for (const m of g.members) {
        map.set(m.id, m.name);
      }
    }
    return map;
  }, [friends, groups, user]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response =
        mode === "signup"
          ? await api.signup({
              name: authForm.name,
              username: authForm.username,
              email: authForm.email,
              password: authForm.password,
              defaultCurrency: authForm.defaultCurrency
            })
          : await api.login({ email: authForm.email, password: authForm.password });

      setToken(response.token);
      localStorage.setItem("splitly_token", response.token);
      setUser(response.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("splitly_token");
    setToken("");
    setUser(null);
  }

  async function createFriendRequest() {
    if (!token || !friendRecipient.trim()) return;
    setError("");
    try {
      await api.sendFriendRequest(token, friendRecipient.trim());
      setFriendRecipient("");
      await refreshData(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function respondFriendRequest(id: string, action: "accept" | "decline") {
    if (!token) return;
    setError("");
    try {
      await api.respondFriendRequest(token, id, action);
      await refreshData(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createGroup() {
    if (!token || !groupForm.name.trim()) return;
    setError("");
    try {
      await api.createGroup(token, {
        name: groupForm.name,
        description: groupForm.description
      });
      setGroupForm({ name: "", description: "" });
      await refreshData(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createExpense() {
    if (!token || !user || expenseForm.amountCents <= 0 || !expenseForm.description.trim()) return;

    const participantIds = Array.from(new Set([user.id, ...friends.map((f) => f.id)]));
    if (!participantIds.length) return;

    setError("");
    try {
      await api.createExpense(token, {
        description: expenseForm.description,
        amountCents: expenseForm.amountCents,
        currency: expenseForm.currency,
        date: new Date().toISOString(),
        payerId: user.id,
        splitType: expenseForm.splitType,
        groupId: expenseForm.groupId || undefined,
        category: expenseForm.category,
        note: expenseForm.note,
        participantSplits: participantIds.map((id) => ({ userId: id }))
      });
      setExpenseForm({
        description: "",
        amountCents: 0,
        currency: user.defaultCurrency,
        splitType: "EQUAL",
        category: "food",
        note: "",
        groupId: ""
      });
      await refreshData(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function settleUp() {
    if (!token || !user || !settleForm.receiverId || settleForm.amountCents <= 0) return;
    setError("");
    try {
      await api.settle(token, {
        payerId: user.id,
        receiverId: settleForm.receiverId,
        amountCents: settleForm.amountCents,
        currency: user.defaultCurrency,
        date: new Date().toISOString(),
        note: settleForm.note
      });
      setSettleForm({ receiverId: "", amountCents: 0, note: "" });
      await refreshData(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-shell px-4 py-10 text-ink md:px-10">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <Card className="flex flex-col justify-between bg-gradient-to-br from-peach/70 via-shell to-aqua/60">
            <div>
              <p className="text-xs uppercase tracking-[0.2em]">Splitly</p>
              <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Shared expenses without friendship debt</h1>
            </div>
            <div className="mt-10 grid gap-3 text-sm">
              <p className="rounded-xl bg-white/70 p-3">Track every bill by group, trip, or household.</p>
              <p className="rounded-xl bg-white/70 p-3">Split by equal, exact, percentage, or shares.</p>
              <p className="rounded-xl bg-white/70 p-3">Simplify who pays whom with one tap.</p>
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex gap-2">
              <Button variant={mode === "login" ? "default" : "outline"} onClick={() => setMode("login")}>Log In</Button>
              <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => setMode("signup")}>Sign Up</Button>
            </div>
            <form className="space-y-3" onSubmit={handleAuth}>
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

  return (
    <main className="min-h-screen bg-shell text-ink">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-6 rounded-3xl border border-ink/10 bg-gradient-to-r from-sage/30 via-shell to-aqua/40 p-4 shadow-panel md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em]">Dashboard</p>
              <h1 className="font-display text-3xl">Welcome back, {user?.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <p className="rounded-xl bg-white/80 px-3 py-2 text-sm">Net: {formatMoney(dashboard?.totalBalanceCents ?? 0, user?.defaultCurrency)}</p>
              <Button variant="outline" onClick={logout}>Log out</Button>
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {(["dashboard", "friends", "groups", "expenses", "activity"] as View[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "outline"}
              onClick={() => {
                setView(v);
                setSelectedGroupId(null);
              }}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </nav>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading && <p className="mb-4 text-sm">Loading latest data...</p>}

        {view === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Quick Add Expense</p>
              <Input placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm((s) => ({ ...s, description: e.target.value }))} />
              <Input className="mt-2" type="number" placeholder="Amount in cents" value={expenseForm.amountCents || ""} onChange={(e) => setExpenseForm((s) => ({ ...s, amountCents: Number(e.target.value) || 0 }))} />
              <Input className="mt-2" placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))} />
              <select className="mt-2 h-10 w-full rounded-xl border border-ink/20 bg-white px-3 text-sm" value={expenseForm.groupId} onChange={(e) => setExpenseForm((s) => ({ ...s, groupId: e.target.value }))}>
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <Button className="mt-3 w-full" onClick={createExpense}>Add Expense</Button>
            </Card>

            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Settle Up</p>
              <select className="h-10 w-full rounded-xl border border-ink/20 bg-white px-3 text-sm" value={settleForm.receiverId} onChange={(e) => setSettleForm((s) => ({ ...s, receiverId: e.target.value }))}>
                <option value="">Select friend</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>{friend.name}</option>
                ))}
              </select>
              <Input className="mt-2" type="number" placeholder="Amount in cents" value={settleForm.amountCents || ""} onChange={(e) => setSettleForm((s) => ({ ...s, amountCents: Number(e.target.value) || 0 }))} />
              <Input className="mt-2" placeholder="Note" value={settleForm.note} onChange={(e) => setSettleForm((s) => ({ ...s, note: e.target.value }))} />
              <Button className="mt-3 w-full" variant="secondary" onClick={settleUp}>Record settlement</Button>
            </Card>

            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Simplified Debts</p>
              <div className="space-y-2 text-sm">
                {simplified.length === 0 && <p>No pending debts.</p>}
                {simplified.map((item, idx) => (
                  <p key={`${item.fromUserId}-${item.toUserId}-${idx}`} className="rounded-lg bg-shell p-2">
                    {(userNameById.get(item.fromUserId) ?? item.fromUserId)} pays {(userNameById.get(item.toUserId) ?? item.toUserId)} {formatMoney(item.amountCents, user?.defaultCurrency)}
                  </p>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Recent Expenses</p>
              <div className="space-y-2">
                {(dashboard?.recentExpenses ?? []).map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between rounded-xl bg-shell p-3 text-sm">
                    <span className="flex items-center gap-2"><Receipt size={16} /> {expense.description}</span>
                    <span>{formatMoney(expense.amountCents, expense.currency)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Recent Activity</p>
              <div className="space-y-2 text-sm">
                {(dashboard?.recentActivity ?? []).map((item) => (
                  <p key={item.id} className="rounded-lg bg-shell p-2">
                    {item.actor.name}: {item.type.replaceAll("_", " ").toLowerCase()}
                  </p>
                ))}
              </div>
            </Card>
          </section>
        )}

        {view === "friends" && (
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Add Friend</p>
              <Input placeholder="friend email or username" value={friendRecipient} onChange={(e) => setFriendRecipient(e.target.value)} />
              <Button className="mt-3 w-full" onClick={createFriendRequest}>Send request</Button>
            </Card>

            <Card className="lg:col-span-2">
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Friends & Balances</p>
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between rounded-xl bg-shell p-3 text-sm">
                    <span className="flex items-center gap-2"><Users size={16} /> {friend.name}</span>
                    <span>{friend.netBalanceCents < 0 ? `You owe ${formatMoney(-friend.netBalanceCents)}` : friend.netBalanceCents > 0 ? `${friend.name} owes you ${formatMoney(friend.netBalanceCents)}` : "Settled"}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-3">
              <p className="mb-3 text-xs uppercase tracking-[0.2em]">Incoming Requests</p>
              <div className="space-y-2">
                {requests.incoming.length === 0 && <p className="text-sm">No incoming requests.</p>}
                {requests.incoming.map((req) => {
                  const sender = req.sender as { name?: string; username?: string } | undefined;
                  const id = String(req.id);
                  return (
                    <div key={id} className="flex items-center justify-between rounded-xl bg-shell p-3 text-sm">
                      <span>{sender?.name ?? sender?.username ?? "Unknown"}</span>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => respondFriendRequest(id, "accept")}>Accept</Button>
                        <Button variant="outline" onClick={() => respondFriendRequest(id, "decline")}>Decline</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        )}

        {view === "groups" && selectedGroupId && user && (
          <GroupDetail
            token={token}
            groupId={selectedGroupId}
            currentUserId={user.id}
            defaultCurrency={user.defaultCurrency}
            onBack={() => setSelectedGroupId(null)}
            onChanged={() => refreshData(token)}
          />
        )}

        {view === "groups" && !selectedGroupId && (
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Create Group</p>
              <Input placeholder="Group name" value={groupForm.name} onChange={(e) => setGroupForm((s) => ({ ...s, name: e.target.value }))} />
              <Input className="mt-2" placeholder="Description" value={groupForm.description} onChange={(e) => setGroupForm((s) => ({ ...s, description: e.target.value }))} />
              <Button className="mt-3 w-full" onClick={createGroup}>Create group</Button>
            </Card>

            <Card className="lg:col-span-2">
              <p className="mb-2 text-xs uppercase tracking-[0.2em]">Your Groups</p>
              <div className="space-y-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className="w-full rounded-xl bg-shell p-3 text-left transition hover:bg-aqua/30"
                  >
                    <p className="font-semibold">{group.name}</p>
                    <p className="text-sm text-ink/70">{group.description || "No description"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-2 py-1">{group.memberCount} members</span>
                      <span className="rounded-full bg-white px-2 py-1">{group.expenseCount} expenses</span>
                      <span className="rounded-full bg-white px-2 py-1">{formatMoney(group.totalSpentCents)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </section>
        )}

        {view === "expenses" && (
          <section className="grid gap-4 lg:grid-cols-2">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">{expense.description}</p>
                  <p>{formatMoney(expense.amountCents, expense.currency)}</p>
                </div>
                <p className="text-sm text-ink/70">{new Date(expense.date).toLocaleDateString()} · {expense.category ?? "uncategorized"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.15em]">Split: {expense.splitType}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {expense.splits.map((split) => (
                    <span key={split.id} className="rounded-full bg-shell px-2 py-1">{userNameById.get(split.userId) ?? split.userId}: {formatMoney(split.owedCents, expense.currency)}</span>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        )}

        {view === "activity" && (
          <section className="grid gap-3">
            {activity.map((item) => (
              <Card key={item.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.actor.name}</p>
                  <p className="text-sm text-ink/80">{item.type.replaceAll("_", " ").toLowerCase()}</p>
                </div>
                <p className="text-xs text-ink/60">{new Date(item.createdAt).toLocaleString()}</p>
              </Card>
            ))}
          </section>
        )}

        <div className="pointer-events-none fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs text-surf shadow-xl">
          <HandCoins size={14} />
          <ArrowRightLeft size={14} />
          Always split in cents
        </div>
      </div>
    </main>
  );
}

export default App;
