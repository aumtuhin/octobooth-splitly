import { formatMoney } from "../lib/api";
import type { Expense } from "../types";
import { Card } from "./ui/card";

type Props = {
  expenses: Expense[];
  userNameById: Map<string, string>;
};

export function ExpensesView({ expenses, userNameById }: Props) {
  return (
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
  );
}
