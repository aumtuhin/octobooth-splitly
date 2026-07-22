import { Router } from "express";
import { z } from "zod";
import { ActivityType, FriendRequestStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { LedgerEntry } from "../lib/balance.js";

const router = Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;
    const accepted = await prisma.friendRequest.findMany({
      where: {
        status: FriendRequestStatus.ACCEPTED,
        OR: [{ senderId: myId }, { receiverId: myId }]
      },
      include: {
        sender: true,
        receiver: true
      }
    });

    const friendIds = accepted.map((f) => (f.senderId === myId ? f.receiverId : f.senderId));

    const ledger: LedgerEntry[] = [];

    const expenses = await prisma.expense.findMany({
      where: { OR: [{ payerId: myId }, { splits: { some: { userId: myId } } }] },
      include: { splits: true }
    });

    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.userId !== expense.payerId) {
          ledger.push({
            fromUserId: split.userId,
            toUserId: expense.payerId,
            amountCents: split.owedCents
          });
        }
      }
    }

    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [{ payerId: myId }, { receiverId: myId }]
      }
    });

    for (const s of settlements) {
      ledger.push({ fromUserId: s.payerId, toUserId: s.receiverId, amountCents: s.amountCents });
    }

    const balances = new Map<string, number>();
    for (const entry of ledger) {
      if (entry.fromUserId === myId) {
        balances.set(entry.toUserId, (balances.get(entry.toUserId) ?? 0) + entry.amountCents);
      } else if (entry.toUserId === myId) {
        balances.set(entry.fromUserId, (balances.get(entry.fromUserId) ?? 0) - entry.amountCents);
      }
    }

    const items = accepted
      .map((f) => {
        const friend = f.senderId === myId ? f.receiver : f.sender;
        return {
          id: friend.id,
          name: friend.name,
          username: friend.username,
          email: friend.email,
          netBalanceCents: balances.get(friend.id) ?? 0
        };
      })
      .filter((f) => friendIds.includes(f.id));

    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

router.get("/requests", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;
    const incoming = await prisma.friendRequest.findMany({
      where: { receiverId: myId, status: FriendRequestStatus.PENDING },
      include: { sender: true }
    });
    const outgoing = await prisma.friendRequest.findMany({
      where: { senderId: myId, status: FriendRequestStatus.PENDING },
      include: { receiver: true }
    });
    return res.json({ incoming, outgoing });
  } catch (error) {
    return next(error);
  }
});

const friendRequestSchema = z.object({ recipient: z.string().min(2) });

router.post("/requests", authMiddleware, async (req, res, next) => {
  try {
    const parsed = friendRequestSchema.parse(req.body);
    const myId = req.authUser!.userId;
    const recipient = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.recipient }, { username: parsed.recipient }]
      }
    });
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });
    if (recipient.id === myId) return res.status(400).json({ message: "Cannot add yourself" });

    // A friendship is a single directional record. Check both directions so we
    // don't re-add an existing friend or create a duplicate pending request.
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: myId, receiverId: recipient.id },
          { senderId: recipient.id, receiverId: myId }
        ]
      }
    });

    if (existing?.status === FriendRequestStatus.ACCEPTED) {
      return res.status(200).json({ status: "already_friends", message: `You are already friends with @${recipient.username}.` });
    }
    if (existing?.status === FriendRequestStatus.PENDING) {
      const mine = existing.senderId === myId;
      return res.status(200).json({
        status: mine ? "already_pending" : "incoming_pending",
        message: mine
          ? `Friend request already sent to @${recipient.username}.`
          : `@${recipient.username} already sent you a request. Accept it from your requests.`
      });
    }

    // No relationship yet, or a previously declined one: (re)send a pending
    // request from me. Reuses my-direction record if present, else creates one.
    const request = await prisma.friendRequest.upsert({
      where: { senderId_receiverId: { senderId: myId, receiverId: recipient.id } },
      update: { status: FriendRequestStatus.PENDING },
      create: { senderId: myId, receiverId: recipient.id, status: FriendRequestStatus.PENDING }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.FRIEND_REQUEST_SENT,
        actorId: myId,
        payload: { requestId: request.id, receiverId: recipient.id }
      }
    });

    return res.status(201).json({ status: "sent", message: `Friend request sent to @${recipient.username}.`, request });
  } catch (error) {
    return next(error);
  }
});

const friendDecisionSchema = z.object({ action: z.enum(["accept", "decline"]) });

router.post("/requests/:id", authMiddleware, async (req, res, next) => {
  try {
    const parsed = friendDecisionSchema.parse(req.body);
    const myId = req.authUser!.userId;
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.receiverId !== myId) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    const status = parsed.action === "accept" ? FriendRequestStatus.ACCEPTED : FriendRequestStatus.DECLINED;
    const updated = await prisma.friendRequest.update({ where: { id: request.id }, data: { status } });

    await prisma.activityLog.create({
      data: {
        type: parsed.action === "accept" ? ActivityType.FRIEND_REQUEST_ACCEPTED : ActivityType.FRIEND_REQUEST_DECLINED,
        actorId: myId,
        payload: { requestId: request.id, senderId: request.senderId }
      }
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

export default router;
