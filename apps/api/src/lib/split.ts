export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

export type SplitInput = {
  userId: string;
  exactAmountCents?: number;
  percentage?: number;
  shares?: number;
};

export type ComputedSplit = {
  userId: string;
  owedCents: number;
  exactAmountCents?: number;
  percentage?: number;
  shares?: number;
};

function distributeRemainder(weights: number[], total: number): number[] {
  const sumWeights = weights.reduce((acc, n) => acc + n, 0);
  const base = weights.map((w) => Math.floor((total * w) / sumWeights));
  let allocated = base.reduce((acc, n) => acc + n, 0);

  const order = weights
    .map((w, idx) => ({ idx, remainder: (total * w) % sumWeights }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; allocated < total && i < order.length; i += 1) {
    base[order[i].idx] += 1;
    allocated += 1;
  }

  return base;
}

export function computeSplits(
  totalCents: number,
  splitType: SplitType,
  participants: SplitInput[]
): ComputedSplit[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("Amount must be a positive integer in cents");
  }

  if (!participants.length) {
    throw new Error("At least one participant is required");
  }

  const uniqueIds = new Set(participants.map((p) => p.userId));
  if (uniqueIds.size !== participants.length) {
    throw new Error("Duplicate participants are not allowed");
  }

  if (splitType === "EQUAL") {
    const per = Math.floor(totalCents / participants.length);
    let remainder = totalCents - per * participants.length;
    return participants.map((p) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return { userId: p.userId, owedCents: per + extra };
    });
  }

  if (splitType === "EXACT") {
    const mapped = participants.map((p) => {
      if (!Number.isInteger(p.exactAmountCents) || (p.exactAmountCents ?? 0) < 0) {
        throw new Error("Exact split requires non-negative integer exact amounts");
      }
      return {
        userId: p.userId,
        owedCents: p.exactAmountCents as number,
        exactAmountCents: p.exactAmountCents
      };
    });

    const sum = mapped.reduce((acc, p) => acc + p.owedCents, 0);
    if (sum !== totalCents) {
      throw new Error("Exact split amounts must add up to total amount");
    }
    return mapped;
  }

  if (splitType === "PERCENTAGE") {
    const weights = participants.map((p) => p.percentage ?? 0);
    if (weights.some((w) => w < 0)) {
      throw new Error("Percentages cannot be negative");
    }
    const totalPercent = weights.reduce((acc, w) => acc + w, 0);
    if (Math.abs(totalPercent - 100) > 0.001) {
      throw new Error("Percentages must add up to 100");
    }

    const owed = distributeRemainder(weights.map((w) => Math.round(w * 1000)), totalCents);
    return participants.map((p, idx) => ({
      userId: p.userId,
      owedCents: owed[idx],
      percentage: p.percentage
    }));
  }

  const shares = participants.map((p) => p.shares ?? 0);
  if (shares.some((s) => !Number.isInteger(s) || s < 0)) {
    throw new Error("Shares must be non-negative integers");
  }
  const totalShares = shares.reduce((acc, s) => acc + s, 0);
  if (totalShares <= 0) {
    throw new Error("At least one positive share is required");
  }

  const owed = distributeRemainder(shares, totalCents);
  return participants.map((p, idx) => ({
    userId: p.userId,
    owedCents: owed[idx],
    shares: p.shares
  }));
}
