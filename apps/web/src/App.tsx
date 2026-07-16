import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, HandCoins } from "lucide-react";
import { api } from "./lib/api";
import type { Activity, Expense, Friend, FriendRequestsPayload, Group, SimplifiedDebt, User } from "./types";
import { AuthScreen, type AuthFormState, type AuthMode } from "./components/AuthScreen";
import { AppHeader } from "./components/AppHeader";
import { NavTabs, type View } from "./components/NavTabs";
import { DashboardView, type ExpenseFormState, type SettleFormState } from "./components/DashboardView";
import { FriendsView } from "./components/FriendsView";
import { GroupsView, type GroupFormState } from "./components/GroupsView";
import { ExpensesView } from "./components/ExpensesView";
import { ActivityView } from "./components/ActivityView";
import { GroupDetail } from "./components/GroupDetail";
import { clearStoredToken, getStoredToken, setStoredToken } from "./lib/storage";

type DashboardData = {
  totalBalanceCents: number;
  recentActivity: Activity[];
  recentExpenses: Expense[];
};

function App() {
  const [token, setToken] = useState<string>("");
  const [tokenChecked, setTokenChecked] = useState(false);
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
  const [simplified, setSimplified] = useState<SimplifiedDebt[]>([]);
  const [requests, setRequests] = useState<FriendRequestsPayload>({ incoming: [], outgoing: [] });

  const [authForm, setAuthForm] = useState<AuthFormState>({
    name: "",
    username: "",
    email: "",
    password: "",
    defaultCurrency: "USD"
  });

  const [friendRecipient, setFriendRecipient] = useState("");
  const [groupForm, setGroupForm] = useState<GroupFormState>({ name: "", description: "" });
  const [settleForm, setSettleForm] = useState<SettleFormState>({ receiverId: "", amountCents: 0, note: "" });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    description: "",
    amountCents: 0,
    currency: "USD",
    splitType: "EQUAL",
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
    getStoredToken().then((stored) => {
      if (stored) setToken(stored);
      setTokenChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refreshData(token)
      .catch((err: Error) => {
        void clearStoredToken();
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
      await setStoredToken(response.token);
      setUser(response.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await clearStoredToken();
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

  if (!tokenChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-shell text-ink">
        <p className="text-sm">Loading Splitly...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <AuthScreen
        mode={mode}
        onModeChange={setMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        error={error}
        loading={loading}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <main className="min-h-screen bg-shell text-ink">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <AppHeader
          userName={user?.name}
          netBalanceCents={dashboard?.totalBalanceCents ?? 0}
          currency={user?.defaultCurrency}
          onLogout={logout}
        />

        <NavTabs
          view={view}
          onSelect={(v) => {
            setView(v);
            setSelectedGroupId(null);
          }}
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading && <p className="mb-4 text-sm">Loading latest data...</p>}

        {view === "dashboard" && (
          <DashboardView
            user={user}
            dashboard={dashboard}
            groups={groups}
            friends={friends}
            simplified={simplified}
            userNameById={userNameById}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            onCreateExpense={createExpense}
            settleForm={settleForm}
            setSettleForm={setSettleForm}
            onSettleUp={settleUp}
          />
        )}

        {view === "friends" && (
          <FriendsView
            friends={friends}
            friendRecipient={friendRecipient}
            setFriendRecipient={setFriendRecipient}
            onSendRequest={createFriendRequest}
            requests={requests}
            onRespond={respondFriendRequest}
          />
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
          <GroupsView
            groups={groups}
            groupForm={groupForm}
            setGroupForm={setGroupForm}
            onCreateGroup={createGroup}
            onSelectGroup={setSelectedGroupId}
          />
        )}

        {view === "expenses" && <ExpensesView expenses={expenses} userNameById={userNameById} />}

        {view === "activity" && <ActivityView activity={activity} />}

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
