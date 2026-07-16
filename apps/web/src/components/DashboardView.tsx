import { Receipt } from "lucide-react";
import { formatMoney } from "../lib/api";
import type { Activity, Expense, Friend, Group, SimplifiedDebt, User } from "../types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export type ExpenseFormState = {
  description: string;
  amountCents: number;
  currency: string;
  splitType: "EQUAL";
  category: string;
  note: string;
  groupId: string;
};

export type SettleFormState = {
  receiverId: string;
  amountCents: number;
  note: string;
};

type DashboardData = {
  totalBalanceCents: number;
  recentActivity: Activity[];
  recentExpenses: Expense[];
};

type Props = {
  user: User | null;
  dashboard: DashboardData | null;
  groups: Group[];
  friends: Friend[];
  simplified: SimplifiedDebt[];
  userNameById: Map<string, string>;
  expenseForm: ExpenseFormState;
  setExpenseForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  onCreateExpense: () => void;
  settleForm: SettleFormState;
  setSettleForm: React.Dispatch<React.SetStateAction<SettleFormState>>;
  onSettleUp: () => void;
};

export function DashboardView({
  user,
  dashboard,
  groups,
  friends,
  simplified,
  userNameById,
  expenseForm,
  setExpenseForm,
  onCreateExpense,
  settleForm,
  setSettleForm,
  onSettleUp
}: Props) {
  return (
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
        <Button className="mt-3 w-full" onClick={onCreateExpense}>Add Expense</Button>
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
        <Button className="mt-3 w-full" variant="secondary" onClick={onSettleUp}>Record settlement</Button>
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
  );
}
