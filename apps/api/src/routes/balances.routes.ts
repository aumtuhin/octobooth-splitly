import { Router } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { simplifyDebts, type LedgerEntry } from "../lib/balance.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;

    const expenseWhere = groupId
      ? { groupId }
      : {
          OR: [
            { payerId: myId },
            { splits: { some: { userId: myId } } },
            { group: { members: { some: { userId: myId } } } }
          ]
        };

    const expenses = await prisma.expense.findMany({ where: expenseWhere, include: { splits: true } });
    const settlements = await prisma.settlement.findMany({ where: groupId ? { groupId } : undefined });

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

    const simplified = simplifyDebts(ledger);
    return res.json({ simplified });
  } catch (error) {
    return next(error);
  }
});

export default router;
