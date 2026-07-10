import { describe, expect, it } from "vitest";
import { computeSplits } from "../lib/split.js";
import { simplifyDebts } from "../lib/balance.js";

describe("computeSplits", () => {
  it("splits equally with remainder", () => {
    const result = computeSplits(1000, "EQUAL", [
      { userId: "a" },
      { userId: "b" },
      { userId: "c" }
    ]);

    expect(result.reduce((acc, s) => acc + s.owedCents, 0)).toBe(1000);
    expect(result.map((r) => r.owedCents)).toEqual([334, 333, 333]);
  });

  it("supports exact amounts", () => {
    const result = computeSplits(1000, "EXACT", [
      { userId: "a", exactAmountCents: 200 },
      { userId: "b", exactAmountCents: 800 }
    ]);
    expect(result.map((r) => r.owedCents)).toEqual([200, 800]);
  });

  it("supports percentages", () => {
    const result = computeSplits(1000, "PERCENTAGE", [
      { userId: "a", percentage: 50 },
      { userId: "b", percentage: 30 },
      { userId: "c", percentage: 20 }
    ]);

    expect(result.reduce((acc, s) => acc + s.owedCents, 0)).toBe(1000);
  });

  it("supports shares", () => {
    const result = computeSplits(1000, "SHARES", [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 3 }
    ]);

    expect(result.map((r) => r.owedCents)).toEqual([250, 750]);
  });
});

describe("simplifyDebts", () => {
  it("minimizes transactions", () => {
    const simplified = simplifyDebts([
      { fromUserId: "u1", toUserId: "u2", amountCents: 1000 },
      { fromUserId: "u1", toUserId: "u3", amountCents: 500 },
      { fromUserId: "u4", toUserId: "u1", amountCents: 700 }
    ]);

    const total = simplified.reduce((acc, s) => acc + s.amountCents, 0);
    expect(total).toBeGreaterThan(0);
    expect(simplified.length).toBeLessThanOrEqual(3);
  });
});
