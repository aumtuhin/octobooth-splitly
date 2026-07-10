import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ActivityType, ExpenseSplitType, FriendRequestStatus, GroupRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { authMiddleware } from "./middleware/auth.js";
import { computeSplits } from "./lib/split.js";
import { simplifyDebts, type LedgerEntry } from "./lib/balance.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use("/uploads", express.static(path.resolve(uploadDir)));

const upload = multer({ dest: uploadDir });

function toPublicUser(user: { id: string; name: string; email: string; username: string; avatarUrl: string | null; defaultCurrency: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    defaultCurrency: user.defaultCurrency
  };
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET ?? "", {
    expiresIn: "7d"
  });
}

const signupSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
  defaultCurrency: z.string().min(3).max(3).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: parsed.email }, { username: parsed.username }]
      }
    });
    if (existing) {
      return res.status(409).json({ message: "Email or username already in use" });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        username: parsed.username,
        email: parsed.email,
        defaultCurrency: parsed.defaultCurrency ?? "USD",
        passwordHash
      }
    });

    const token = signToken({ id: user.id, email: user.email });
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ id: user.id, email: user.email });
    return res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.userId } });
    return res.json(toPublicUser(user));
  } catch (error) {
    return next(error);
  }
});

const friendRequestSchema = z.object({ recipient: z.string().min(2) });

app.get("/api/friends", authMiddleware, async (req, res, next) => {
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

    const items = accepted.map((f) => {
      const friend = f.senderId === myId ? f.receiver : f.sender;
      return {
        id: friend.id,
        name: friend.name,
        username: friend.username,
        email: friend.email,
        netBalanceCents: balances.get(friend.id) ?? 0
      };
    }).filter((f) => friendIds.includes(f.id));

    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/friends/requests", authMiddleware, async (req, res, next) => {
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

app.post("/api/friends/requests", authMiddleware, async (req, res, next) => {
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

    return res.status(201).json(request);
  } catch (error) {
    return next(error);
  }
});

const friendDecisionSchema = z.object({ action: z.enum(["accept", "decline"]) });

app.post("/api/friends/requests/:id", authMiddleware, async (req, res, next) => {
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

const createGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional()
});

app.get("/api/groups", authMiddleware, async (req, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: req.authUser!.userId } } },
      include: {
        members: { include: { user: true } },
        expenses: { include: { splits: true } },
        _count: { select: { members: true, expenses: true } }
      }
    });

    const data = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      members: g.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      totalSpentCents: g.expenses.reduce((acc, e) => acc + e.amountCents, 0)
    }));

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/groups", authMiddleware, async (req, res, next) => {
  try {
    const parsed = createGroupSchema.parse(req.body);
    const myId = req.authUser!.userId;
    const memberIds = Array.from(new Set([myId, ...(parsed.memberIds ?? [])]));

    const group = await prisma.group.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        createdById: myId,
        members: {
          create: memberIds.map((id) => ({ userId: id, role: id === myId ? GroupRole.ADMIN : GroupRole.MEMBER }))
        }
      },
      include: { members: true }
    });

    await prisma.activityLog.create({
      data: { type: ActivityType.GROUP_CREATED, actorId: myId, groupId: group.id }
    });

    return res.status(201).json(group);
  } catch (error) {
    return next(error);
  }
});

const groupMemberSchema = z.object({
  userId: z.string().optional(),
  identifier: z.string().optional()
}).refine((data) => Boolean(data.userId || data.identifier), {
  message: "userId or identifier is required"
});

app.post("/api/groups/:id/members", authMiddleware, async (req, res, next) => {
  try {
    const parsed = groupMemberSchema.parse(req.body);
    const myId = req.authUser!.userId;

    const admin = await prisma.groupMember.findFirst({
      where: { groupId: req.params.id, userId: myId, role: GroupRole.ADMIN }
    });
    if (!admin) return res.status(403).json({ message: "Only admins can invite members" });

    let userId = parsed.userId;
    if (!userId && parsed.identifier) {
      const found = await prisma.user.findFirst({
        where: {
          OR: [{ email: parsed.identifier }, { username: parsed.identifier }]
        }
      });
      if (!found) {
        return res.status(404).json({ message: "User not found" });
      }
      userId = found.id;
    }

    const member = await prisma.groupMember.create({
      data: { groupId: req.params.id, userId: userId as string, role: GroupRole.MEMBER }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.GROUP_MEMBER_ADDED,
        actorId: myId,
        groupId: req.params.id,
        payload: { userId }
      }
    });

    return res.status(201).json(member);
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/groups/:id/members/:userId", authMiddleware, async (req, res, next) => {
  try {
    const myId = req.authUser!.userId;

    const admin = await prisma.groupMember.findFirst({
      where: { groupId: req.params.id, userId: myId, role: GroupRole.ADMIN }
    });
    if (!admin) return res.status(403).json({ message: "Only admins can remove members" });

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: req.params.userId
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.GROUP_MEMBER_REMOVED,
        actorId: myId,
        groupId: req.params.id,
        payload: { userId: req.params.userId }
      }
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

const createExpenseSchema = z.object({
  description: z.string().min(2),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  date: z.coerce.date(),
  payerId: z.string(),
  participantSplits: z.array(
    z.object({
      userId: z.string(),
      exactAmountCents: z.number().int().nonnegative().optional(),
      percentage: z.number().nonnegative().optional(),
      shares: z.number().int().nonnegative().optional()
    })
  ).min(1),
  splitType: z.nativeEnum(ExpenseSplitType),
  groupId: z.string().optional(),
  category: z.string().optional(),
  note: z.string().optional()
});

app.post("/api/expenses", authMiddleware, upload.single("receipt"), async (req, res, next) => {
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

app.get("/api/expenses", authMiddleware, async (req, res, next) => {
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

app.patch("/api/expenses/:id", authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({
      description: z.string().min(2).optional(),
      category: z.string().optional(),
      note: z.string().optional(),
      date: z.coerce.date().optional()
    });
    const parsed = schema.parse(req.body);

    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: parsed
    });

    await prisma.activityLog.create({
      data: {
        type: ActivityType.EXPENSE_UPDATED,
        actorId: req.authUser!.userId,
        groupId: existing.groupId ?? undefined,
        expenseId: existing.id
      }
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

const settlementSchema = z.object({
  payerId: z.string(),
  receiverId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  date: z.coerce.date(),
  groupId: z.string().optional(),
  note: z.string().optional()
});

app.post("/api/settlements", authMiddleware, async (req, res, next) => {
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

app.get("/api/balances", authMiddleware, async (req, res, next) => {
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

app.get("/api/activity", authMiddleware, async (req, res, next) => {
  try {
    const activity = await prisma.activityLog.findMany({
      where: {
        OR: [
          { actorId: req.authUser!.userId },
          { group: { members: { some: { userId: req.authUser!.userId } } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: { id: true, name: true, username: true }
        }
      }
    });

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/dashboard", authMiddleware, async (req, res, next) => {
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
          OR: [
            { actorId: userId },
            { group: { members: { some: { userId } } } }
          ]
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

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: error.issues });
  }

  if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025") {
    return res.status(404).json({ message: "Resource not found" });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
