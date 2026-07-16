import { Router } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { LedgerEntry } from "../lib/balance.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.authUser!.userId;
    const [expenses, settlements, recentActivity] = await Promise.all([
      prisma.expense.findMany({
        where: {
          OR: [{ payerId: userId }, { splits: { some: { userId } } }]
        },
        include: { splits: true },
        orderBy: { date: "desc" }
      }),
      prisma.settlement.findMany({
        where: {
          OR: [{ payerId: userId }, { receiverId: userId }]
        }
      }),
      prisma.activityLog.findMany({
        where: {
          OR: [{ actorId: userId }, { group: { members: { some: { userId } } } }]
        },
        include: { actor: { select: { name: true, id: true } } },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    const ledger: LedgerEntry[] = [];
    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.userId !== expense.payerId) {
          ledger.push({ fromUserId: split.userId, toUserId: expense.payerId, amountCents: split.owedCents });
        }
      }
    }
    for (const s of settlements) {
      ledger.push({ fromUserId: s.payerId, toUserId: s.receiverId, amountCents: s.amountCents });
    }

    let totalBalanceCents = 0;
    for (const entry of ledger) {
      if (entry.fromUserId === userId) totalBalanceCents -= entry.amountCents;
      if (entry.toUserId === userId) totalBalanceCents += entry.amountCents;
    }

    return res.json({
      totalBalanceCents,
      recentActivity,
      recentExpenses: expenses.slice(0, 5)
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
