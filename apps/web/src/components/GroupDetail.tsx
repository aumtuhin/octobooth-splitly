import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { api, formatMoney } from "../lib/api";
import type { Expense, GroupDetail as GroupDetailType } from "../types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

type SimplifiedDebt = { fromUserId: string; toUserId: string; amountCents: number };

type Props = {
  token: string;
  groupId: string;
  currentUserId: string;
  defaultCurrency: string;
  onBack: () => void;
  onChanged: () => void;
};

const emptyExpenseForm = {
  description: "",
  amountCents: 0,
  category: "general",
  note: "",
  payerId: ""
};

export function GroupDetail({ token, groupId, currentUserId, defaultCurrency, onBack, onChanged }: Props) {
  const [group, setGroup] = useState<GroupDetailType | null>(null);
  const [simplified, setSimplified] = useState<SimplifiedDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyExpenseForm);

  const nameById = new Map((group?.members ?? []).map((m) => [m.id, m.name]));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [g, bal] = await Promise.all([api.getGroup(token, groupId), api.balances(token, groupId)]);
      setGroup(g);
      setSimplified(bal.simplified);
      setExpenseForm((s) => (s.payerId ? s : { ...s, payerId: currentUserId }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setGroup(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function addExpense() {
    if (!group || !expenseForm.description.trim() || expenseForm.amountCents <= 0) return;
    setError("");
    try {
      await api.createExpense(token, {
        description: expenseForm.description,
        amountCents: expenseForm.amountCents,
        currency: defaultCurrency,
        date: new Date().toISOString(),
        payerId: expenseForm.payerId || currentUserId,
        splitType: "EQUAL",
        groupId: group.id,
        category: expenseForm.category,
        note: expenseForm.note,
        participantSplits: group.members.map((m) => ({ userId: m.id }))
      });
      setExpenseForm({ ...emptyExpenseForm, payerId: currentUserId });
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditForm({
      description: expense.description,
      amountCents: expense.amountCents,
      category: expense.category ?? "",
      note: expense.note ?? "",
      payerId: expense.payerId
    });
  }

  async function saveEdit(expense: Expense) {
    if (!group || !editForm.description.trim() || editForm.amountCents <= 0) return;
    setError("");
    try {
      await api.updateExpense(token, expense.id, {
        description: editForm.description,
        amountCents: editForm.amountCents,
        category: editForm.category,
        note: editForm.note,
        payerId: editForm.payerId,
        splitType: "EQUAL",
        participantSplits: group.members.map((m) => ({ userId: m.id }))
      });
      setEditingId(null);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeExpense(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    setError("");
    try {
      await api.deleteExpense(token, id);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!group) {
    return (
      <section>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={14} className="mr-2" /> Back to groups
        </Button>
        {loading && <p className="mt-4 text-sm">Loading group...</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft size={14} className="mr-2" /> Back to groups
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-2xl">{group.name}</p>
            <p className="text-sm text-ink/70">{group.description || "No description"}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-shell px-2 py-1">{group.memberCount} members</span>
            <span className="rounded-full bg-shell px-2 py-1">{group.expenseCount} expenses</span>
            <span className="rounded-full bg-shell px-2 py-1">{formatMoney(group.totalSpentCents, defaultCurrency)} total</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {group.members.map((m) => (
            <span key={m.id} className="flex items-center gap-1 rounded-full bg-shell px-2 py-1">
              <UsersIcon size={12} /> {m.name} {m.role === "ADMIN" ? "(admin)" : ""}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-2 text-xs uppercase tracking-[0.2em]">Add Expense</p>
          <Input placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm((s) => ({ ...s, description: e.target.value }))} />
          <Input className="mt-2" type="number" placeholder="Amount in cents" value={expenseForm.amountCents || ""} onChange={(e) => setExpenseForm((s) => ({ ...s, amountCents: Number(e.target.value) || 0 }))} />
          <Input className="mt-2" placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))} />
          <select
            className="mt-2 h-10 w-full rounded-xl border border-ink/20 bg-white px-3 text-sm"
            value={expenseForm.payerId}
            onChange={(e) => setExpenseForm((s) => ({ ...s, payerId: e.target.value }))}
          >
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} paid
              </option>
            ))}
          </select>
          <Button className="mt-3 w-full" onClick={addExpense}>
            <Plus size={14} className="mr-1" /> Add expense
          </Button>
        </Card>

        <Card>
          <p className="mb-2 text-xs uppercase tracking-[0.2em]">Who owes what</p>
          <div className="space-y-2 text-sm">
            {simplified.length === 0 && <p>Everyone is settled up.</p>}
            {simplified.map((item, idx) => (
              <p key={`${item.fromUserId}-${item.toUserId}-${idx}`} className="rounded-lg bg-shell p-2">
                {nameById.get(item.fromUserId) ?? item.fromUserId} owes {nameById.get(item.toUserId) ?? item.toUserId}{" "}
                {formatMoney(item.amountCents, defaultCurrency)}
              </p>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em]">Expenses</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {group.expenses.length === 0 && <p className="text-sm">No expenses in this group yet.</p>}
          {group.expenses.map((expense) => (
            <Card key={expense.id}>
              {editingId === expense.id ? (
                <div className="space-y-2">
                  <Input value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} />
                  <Input type="number" value={editForm.amountCents || ""} onChange={(e) => setEditForm((s) => ({ ...s, amountCents: Number(e.target.value) || 0 }))} />
                  <Input placeholder="Category" value={editForm.category} onChange={(e) => setEditForm((s) => ({ ...s, category: e.target.value }))} />
                  <select
                    className="h-10 w-full rounded-xl border border-ink/20 bg-white px-3 text-sm"
                    value={editForm.payerId}
                    onChange={(e) => setEditForm((s) => ({ ...s, payerId: e.target.value }))}
                  >
                    {group.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} paid
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => saveEdit(expense)}>
                      Save
                    </Button>
                    <Button className="flex-1" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold">{expense.description}</p>
                    <p>{formatMoney(expense.amountCents, expense.currency)}</p>
                  </div>
                  <p className="text-sm text-ink/70">
                    {new Date(expense.date).toLocaleDateString()} · {expense.category ?? "uncategorized"} · paid by{" "}
                    {nameById.get(expense.payerId) ?? expense.payerId}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.15em]">Split: {expense.splitType}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {expense.splits.map((split) => (
                      <span key={split.id} className="rounded-full bg-shell px-2 py-1">
                        {nameById.get(split.userId) ?? split.userId}: {formatMoney(split.owedCents, expense.currency)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" onClick={() => startEdit(expense)}>
                      <Pencil size={14} className="mr-1" /> Edit
                    </Button>
                    <Button variant="outline" onClick={() => removeExpense(expense.id)}>
                      <Trash2 size={14} className="mr-1" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
