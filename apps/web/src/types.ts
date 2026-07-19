export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  avatarStyle?: string | null;
  avatarSeed?: string | null;
  defaultCurrency: string;
  createdAt?: string;
};

export type Friend = {
  id: string;
  name: string;
  username: string;
  email: string;
  netBalanceCents: number;
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  members: Array<{ id: string; name: string; role: string }>;
  memberCount: number;
  expenseCount: number;
  totalSpentCents: number;
};

export type GroupDetail = Group & {
  expenses: Expense[];
};

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  date: string;
  payerId: string;
  groupId?: string;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  category?: string;
  note?: string;
  receiptImageUrl?: string;
  splits: Array<{
    id: string;
    userId: string;
    owedCents: number;
    exactAmountCents?: number;
    percentage?: number;
    shares?: number;
  }>;
};

export type Activity = {
  id: string;
  type: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    username?: string;
  };
  payload?: Record<string, unknown>;
};

export type SimplifiedDebt = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export type FriendRequestsPayload = {
  incoming: Array<Record<string, unknown>>;
  outgoing: Array<Record<string, unknown>>;
};
