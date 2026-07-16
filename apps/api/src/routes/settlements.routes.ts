import { Router } from "express";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const settlementSchema = z.object({
  payerId: z.string(),
  receiverId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  date: z.coerce.date(),
  groupId: z.string().optional(),
  note: z.string().optional()
});

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const parsed = settlementSchema.parse(req.body);
    const settlement = await prisma.settlement.create({
      data: {
        ...parsed,
        currency: parsed.currency.toUpperCase(),
        createdById: req.authUser!.userId
      }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.SETTLEMENT_CREATED,
        actorId: req.authUser!.userId,
        groupId: parsed.groupId,
        payload: { amountCents: parsed.amountCents, payerId: parsed.payerId, receiverId: parsed.receiverId }
      }
    });

    return res.status(201).json(settlement);
  } catch (error) {
    return next(error);
  }
});

export default router;
