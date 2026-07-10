export type LedgerEntry = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export type NetBalance = {
  userId: string;
  amountCents: number;
};

export type SimplifiedDebt = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export function aggregateBalances(entries: LedgerEntry[]): Map<string, number> {
  const balances = new Map<string, number>();

  for (const entry of entries) {
    balances.set(entry.fromUserId, (balances.get(entry.fromUserId) ?? 0) - entry.amountCents);
    balances.set(entry.toUserId, (balances.get(entry.toUserId) ?? 0) + entry.amountCents);
  }

  return balances;
}

export function simplifyDebts(entries: LedgerEntry[]): SimplifiedDebt[] {
  const balances = aggregateBalances(entries);

  const creditors: NetBalance[] = [];
  const debtors: NetBalance[] = [];

  for (const [userId, amountCents] of balances.entries()) {
    if (amountCents > 0) creditors.push({ userId, amountCents });
    if (amountCents < 0) debtors.push({ userId, amountCents: -amountCents });
  }

  creditors.sort((a, b) => b.amountCents - a.amountCents);
  debtors.sort((a, b) => b.amountCents - a.amountCents);

  const settlements: SimplifiedDebt[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(debtor.amountCents, creditor.amountCents);

    if (amount > 0) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountCents: amount
      });
    }

    debtor.amountCents -= amount;
    creditor.amountCents -= amount;

    if (debtor.amountCents === 0) d += 1;
    if (creditor.amountCents === 0) c += 1;
  }

  return settlements;
}
