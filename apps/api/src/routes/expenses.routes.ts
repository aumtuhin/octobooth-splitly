import { Router } from "express";
import { z } from "zod";
import { ActivityType, ExpenseSplitType } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { computeSplits } from "../lib/split.js";
import { upload, uploadDir } from "../lib/upload.js";

const router = Router();

const participantSplitSchema = z.object({
  userId: z.string(),
  exactAmountCents: z.number().int().nonnegative().optional(),
  percentage: z.number().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional()
});

const createExpenseSchema = z.object({
  description: z.string().min(2),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  date: z.coerce.date(),
  payerId: z.string(),
  participantSplits: z.array(participantSplitSchema).min(1),
  splitType: z.nativeEnum(ExpenseSplitType),
  groupId: z.string().optional(),
  category: z.string().optional(),
  note: z.string().optional()
});

router.post("/", authMiddleware, upload.single("receipt"), async (req, res, next) => {
  try {
    const body = req.file
      ? {
          ...req.body,
          amountCents: Number(req.body.amountCents),
          participantSplits: JSON.parse(req.body.participantSplits),
          date: new Date(req.body.date)
        }
      : req.body;

    const parsed = createExpenseSchema.parse(body);
    const splits = computeSplits(parsed.amountCents, parsed.splitType, parsed.participantSplits);

    const created = await prisma.expense.create({
      data: {
        description: parsed.description,
        amountCents: parsed.amountCents,
        currency: parsed.currency.toUpperCase(),
        date: parsed.date,
        payerId: parsed.payerId,
        groupId: parsed.groupId,
        splitType: parsed.splitType,
        category: parsed.category,
        note: parsed.note,
        receiptImageUrl: req.file ? `/${uploadDir}/${req.file.filename}` : undefined,
        createdById: req.authUser!.userId,
        splits: {
          create: splits
        }
      },
      include: { splits: true }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.EXPENSE_CREATED,
        actorId: req.authUser!.userId,
        groupId: parsed.groupId,
        expenseId: created.id,
        payload: { amountCents: parsed.amountCents }
      }
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const items = await prisma.expense.findMany({
      where: {
        OR: [
          { payerId: req.authUser!.userId },
          { splits: { some: { userId: req.authUser!.userId } } },
          { group: { members: { some: { userId: req.authUser!.userId } } } }
        ]
      },
      include: { splits: true },
      orderBy: { date: "desc" }
    });

    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

const updateExpenseSchema = z.object({
  description: z.string().min(2).optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  date: z.coerce.date().optional(),
  payerId: z.string().optional(),
  splitType: z.nativeEnum(ExpenseSplitType).optional(),
  participantSplits: z.array(participantSplitSchema).min(1).optional(),
  category: z.string().optional(),
  note: z.string().optional()
});

async function assertCanManageExpense(expense: { createdById: string; payerId: string; groupId: string | null }, userId: string) {
  if (expense.createdById === userId || expense.payerId === userId) return true;
  if (!expense.groupId) return false;
  const membership = await prisma.groupMember.findFirst({ where: { groupId: expense.groupId, userId } });
  return Boolean(membership);
}

router.patch("/:id", authMiddleware, async (req, res, next) => {
  try {
    const parsed = updateExpenseSchema.parse(req.body);
    const myId = req.authUser!.userId;

    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (!(await assertCanManageExpense(existing, myId))) {
      return res.status(403).json({ message: "Not allowed to edit this expense" });
    }

    const amountCents = parsed.amountCents ?? existing.amountCents;
    const splitType = parsed.splitType ?? existing.splitType;

    let splitsUpdate: { deleteMany: Record<string, never>; create: ReturnType<typeof computeSplits> } | undefined;
    if (parsed.participantSplits || parsed.amountCents !== undefined || parsed.splitType !== undefined) {
      const existingSplits = await prisma.expenseSplit.findMany({ where: { expenseId: existing.id } });
      const participants =
        parsed.participantSplits ??
        existingSplits.map((s) => ({
          userId: s.userId,
          exactAmountCents: s.exactAmountCents ?? undefined,
          percentage: s.percentage ? Number(s.percentage) : undefined,
          shares: s.shares ?? undefined
        }));
      splitsUpdate = { deleteMany: {}, create: computeSplits(amountCents, splitType, participants) };
    }

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        description: parsed.description,
        category: parsed.category,
        note: parsed.note,
        date: parsed.date,
        amountCents: parsed.amountCents,
        currency: parsed.currency?.toUpperCase(),
        payerId: parsed.payerId,
        splitType: parsed.splitType,
        ...(splitsUpdate ? { splits: splitsUpdate } : {})
      },
      include: { splits: true }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.EXPENSE_UPDATED,
        actorId: myId,
        groupId: existing.groupId ?? undefined,
        expenseId: existing.id
      }
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (!(await assertCanManageExpense(existing, myId))) {
      return res.status(403).json({ message: "Not allowed to delete this expense" });
    }

    await prisma.expense.delete({ where: { id: req.params.id } });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.EXPENSE_DELETED,
        actorId: myId,
        groupId: existing.groupId ?? undefined,
        payload: { description: existing.description, amountCents: existing.amountCents }
      }
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
