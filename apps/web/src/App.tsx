import { useEffect, useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { api } from "./lib/api";
import { parseAmountToCents } from "./lib/money";
import { ADD_FRIEND_PARAM } from "./lib/friendLink";
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
import { ProfileView } from "./components/ProfileView";
import { clearStoredToken, getStoredToken, setStoredToken } from "./lib/storage";
import { useTheme } from "./lib/theme";

type DashboardData = {
  totalBalanceCents: number;
  recentActivity: Activity[];
  recentExpenses: Expense[];
};

function App() {
  const { theme, setTheme } = useTheme();
  const [token, setToken] = useState<string>("");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [view, setView] = useState<View>("dashboard");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [pendingAdd, setPendingAdd] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(ADD_FRIEND_PARAM)
  );

  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [simplified, setSimplified] = useState<SimplifiedDebt[]>([]);
  const [debtUsers, setDebtUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [requests, setRequests] = useState<FriendRequestsPayload>({ incoming: [], outgoing: [] });

  const [authForm, setAuthForm] = useState<AuthFormState>({
    name: "",
    username: "",
    email: "",
    password: ""
  });

  const [friendRecipient, setFriendRecipient] = useState("");
  const [groupForm, setGroupForm] = useState<GroupFormState>({ name: "", description: "" });
  const [settleForm, setSettleForm] = useState<SettleFormState>({ receiverId: "", amount: "", note: "" });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    description: "",
    amount: "",
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
    setDebtUsers(bal.users);
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
      .catch((err: Error & { status?: number }) => {
        // Only force a logout when the token is genuinely rejected (401).
        // Transient failures (5xx, network) should keep the session so a
        // hard refresh during a backend hiccup doesn't sign the user out.
        if (err.status === 401) {
          void clearStoredToken();
          setToken("");
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  // Handle a scanned friend QR / invite link (?add=<username>): once the
  // visitor is logged in, send them a friend request to that user, then strip
  // the param from the URL so it isn't reprocessed on the next render.
  useEffect(() => {
    if (!token || !user || !pendingAdd) return;
    const target = pendingAdd;
    const clearParam = () => {
      setPendingAdd(null);
      const url = new URL(window.location.href);
      url.searchParams.delete(ADD_FRIEND_PARAM);
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };
    if (target.toLowerCase() === user.username.toLowerCase()) {
      clearParam();
      return;
    }
    (async () => {
      try {
        await api.sendFriendRequest(token, target);
        await refreshData(token);
        setNotice(`Friend request sent to @${target}.`);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        clearParam();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, pendingAdd]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    // Names from balances first, so friends/group members still take precedence.
    for (const u of debtUsers) map.set(u.id, u.name);
    if (user) map.set(user.id, user.name);
    for (const f of friends) map.set(f.id, f.name);
    for (const g of groups) {
      for (const m of g.members) {
        map.set(m.id, m.name);
      }
    }
    return map;
  }, [friends, groups, user, debtUsers]);

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
              password: authForm.password
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
    setNotice("");
    try {
      await api.sendFriendRequest(token, friendRecipient.trim());
      setFriendRecipient("");
      await refreshData(token);
      setNotice("Friend request sent.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function respondFriendRequest(id: string, action: "accept" | "decline") {
    if (!token) return;
    setError("");
    setNotice("");
    try {
      await api.respondFriendRequest(token, id, action);
      await refreshData(token);
      setNotice(action === "accept" ? "Friend request accepted." : "Friend request declined.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createGroup() {
    if (!token || !groupForm.name.trim()) return;
    setError("");
    setNotice("");
    try {
      await api.createGroup(token, {
        name: groupForm.name,
        description: groupForm.description
      });
      setGroupForm({ name: "", description: "" });
      await refreshData(token);
      setNotice("Group created.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createExpense() {
    if (!token || !user || !expenseForm.description.trim()) return;

    const amountCents = parseAmountToCents(expenseForm.amount);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount, e.g. 10.50");
      return;
    }

    const participantIds = Array.from(new Set([user.id, ...friends.map((f) => f.id)]));
    if (!participantIds.length) return;

    setError("");
    setNotice("");
    try {
      await api.createExpense(token, {
        description: expenseForm.description,
        amountCents,
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
        amount: "",
        currency: user.defaultCurrency,
        splitType: "EQUAL",
        category: "food",
        note: "",
        groupId: ""
      });
      await refreshData(token);
      setNotice("Expense added.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function settleUp() {
    if (!token || !user || !settleForm.receiverId) return;

    const amountCents = parseAmountToCents(settleForm.amount);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount, e.g. 10.50");
      return;
    }

    setError("");
    setNotice("");
    try {
      await api.settle(token, {
        payerId: user.id,
        receiverId: settleForm.receiverId,
        amountCents,
        currency: user.defaultCurrency,
        date: new Date().toISOString(),
        note: settleForm.note
      });
      setSettleForm({ receiverId: "", amount: "", note: "" });
      await refreshData(token);
      setNotice("Settlement recorded.");
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
          avatarStyle={user?.avatarStyle}
          avatarSeed={user?.avatarSeed}
          netBalanceCents={dashboard?.totalBalanceCents ?? 0}
          currency={user?.defaultCurrency}
          onLogout={logout}
          onOpenProfile={() => {
            setView("profile");
            setSelectedGroupId(null);
          }}
        />

        <NavTabs
          view={view}
          onSelect={(v) => {
            setView(v);
            setSelectedGroupId(null);
          }}
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="mb-4 rounded-xl bg-sage/20 px-3 py-2 text-sm text-sage" role="status" aria-live="polite">
            {notice}
          </p>
        )}
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

        {view === "profile" && user && (
          <ProfileView
            token={token}
            user={user}
            onUserUpdated={(u) => setUser(u)}
            onLoggedOut={logout}
            theme={theme}
            setTheme={setTheme}
          />
        )}

        <div className="pointer-events-none fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs text-surf shadow-xl">
          <HandCoins size={14} />
          Split fairly, settle easily
        </div>
      </div>
    </main>
  );
}

export default App;
